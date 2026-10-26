// Test-only line-oriented RESP bridge for running the BIS Upstash REST client
// and production Lua against a pinned in-memory Redis implementation.
package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"
	"strconv"
	"strings"

	"github.com/alicebob/miniredis/v2"
)

func writeCommand(w io.Writer, args []string) error {
	if _, err := fmt.Fprintf(w, "*%d\r\n", len(args)); err != nil {
		return err
	}
	for _, arg := range args {
		if _, err := fmt.Fprintf(w, "$%d\r\n%s\r\n", len(arg), arg); err != nil {
			return err
		}
	}
	return nil
}

func readReply(r *bufio.Reader) (any, error) {
	prefix, err := r.ReadByte()
	if err != nil {
		return nil, err
	}
	line, err := r.ReadString('\n')
	if err != nil {
		return nil, err
	}
	line = strings.TrimSuffix(strings.TrimSuffix(line, "\n"), "\r")
	switch prefix {
	case '+':
		return line, nil
	case '-':
		return nil, fmt.Errorf("redis error: %s", line)
	case ':':
		return strconv.ParseInt(line, 10, 64)
	case '$':
		size, parseErr := strconv.Atoi(line)
		if parseErr != nil {
			return nil, parseErr
		}
		if size == -1 {
			return nil, nil
		}
		if size < 0 || size > 8*1024*1024 {
			return nil, fmt.Errorf("invalid bulk length %d", size)
		}
		buf := make([]byte, size+2)
		if _, err = io.ReadFull(r, buf); err != nil {
			return nil, err
		}
		if !bytes.HasSuffix(buf, []byte("\r\n")) {
			return nil, fmt.Errorf("invalid bulk terminator")
		}
		return string(buf[:size]), nil
	case '*':
		size, parseErr := strconv.Atoi(line)
		if parseErr != nil {
			return nil, parseErr
		}
		if size == -1 {
			return nil, nil
		}
		if size < 0 || size > 100000 {
			return nil, fmt.Errorf("invalid array length %d", size)
		}
		values := make([]any, size)
		for i := range values {
			values[i], err = readReply(r)
			if err != nil {
				return nil, err
			}
		}
		return values, nil
	default:
		return nil, fmt.Errorf("unsupported RESP prefix %q", prefix)
	}
}

func execute(addr string, command []string) (any, error) {
	conn, err := net.Dial("tcp", addr)
	if err != nil {
		return nil, err
	}
	defer conn.Close()
	if err := writeCommand(conn, command); err != nil {
		return nil, err
	}
	return readReply(bufio.NewReader(conn))
}

func main() {
	server, err := miniredis.Run()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer server.Close()
	input := bufio.NewScanner(os.Stdin)
	input.Buffer(make([]byte, 4096), 16*1024*1024)
	output := bufio.NewWriter(os.Stdout)
	defer output.Flush()
	if _, err := fmt.Fprintln(output, `{"ready":true}`); err != nil {
		os.Exit(1)
	}
	output.Flush()
	for input.Scan() {
		if strings.TrimSpace(input.Text()) == `{"shutdown":true}` {
			break
		}
		var raw []json.RawMessage
		if err := json.Unmarshal(input.Bytes(), &raw); err != nil {
			writeJSON(output, nil, err)
			continue
		}
		command := make([]string, len(raw))
		valid := true
		for i, item := range raw {
			var text string
			if err := json.Unmarshal(item, &text); err == nil {
				command[i] = text
				continue
			}
			var number json.Number
			decoder := json.NewDecoder(bytes.NewReader(item))
			decoder.UseNumber()
			if err := decoder.Decode(&number); err == nil {
				command[i] = number.String()
				continue
			}
			valid = false
			break
		}
		if !valid || len(command) == 0 {
			writeJSON(output, nil, fmt.Errorf("command must be a nonempty string/number array"))
			continue
		}
		result, err := execute(server.Addr(), command)
		writeJSON(output, result, err)
	}
	if err := input.Err(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func writeJSON(w *bufio.Writer, value any, err error) {
	response := struct {
		Result any    `json:"result"`
		Error  string `json:"error,omitempty"`
	}{Result: value}
	if err != nil {
		response.Error = err.Error()
	}
	_ = json.NewEncoder(w).Encode(response)
	_ = w.Flush()
}
