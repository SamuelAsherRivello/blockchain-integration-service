import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { SingleKey } from "@arkade-os/sdk";
import { Vault } from "./test-wallets/vault.ts";

const commit = "bd17836542c409d176a3ee61782e00a606d10f6c";
const image = `bis-conditional-vault-emulator:${commit.slice(0, 12)}`;
const network = process.argv[3] ?? "signet";
const port = network === "signet" ? 7074 : 7075;
const name = `bis-conditional-vault-${network}`;
const endpoint = `http://127.0.0.1:${port}`;
async function docker(args: string[], env = process.env) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn("docker", args, {
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let result = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(Error("vault-service-docker-timeout"));
    }, 30_000);
    child.stdout.on("data", (data) => {
      result += data;
      if (result.length > 65536) child.kill();
    });
    // Docker errors may include environment/configuration. Never echo them.
    child.stderr.resume();
    child.on("error", () => {
      clearTimeout(timer);
      reject(Error("vault-service-docker-unavailable"));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve(result.trim())
        : reject(Error("vault-service-docker-failed"));
    });
  });
}

try {
  if (
    ![3, 4].includes(process.argv.length) ||
    !["start", "restart"].includes(process.argv[2]) ||
    !["signet", "mutinynet"].includes(network)
  )
    throw Error("vault-service-use-start-or-restart");
  const vault = new Vault();
  const pin = await vault.transaction(async (state) => {
    // This additional private field remains inside the existing DPAPI envelope.
    // It is never added to the public wallet manifest or returned by this script.
    state.conditionalVaultServices ??= {};
    const entry = (state.conditionalVaultServices[network] ??= {
      secret: randomBytes(32).toString("hex"),
      commit,
    });
    if (entry.commit !== commit || !/^[0-9a-f]{64}$/.test(entry.secret))
      throw Error("vault-service-key-version-mismatch");
    const key = SingleKey.fromHex(entry.secret);
    return {
      publicKey: Buffer.from(await key.xOnlyPublicKey()).toString("hex"),
    };
  });
  const existing = await docker([
    "ps",
    "-a",
    "--filter",
    `name=^/${name}$`,
    "--format",
    "{{.Names}}",
  ]);
  if (existing) {
    // Inspect only public fields. Do not print Docker's environment containing the signer.
    const binding = await docker([
      "inspect",
      "--format",
      '{{(index (index .HostConfig.PortBindings "7073/tcp") 0).HostIp}}',
      name,
    ]);
    if (binding !== "127.0.0.1")
      throw Error("vault-service-unsafe-port-binding");
    const imageId = await docker([
      "image",
      "inspect",
      "--format",
      "{{.Id}}",
      image,
    ]);
    const containerImage = await docker([
      "inspect",
      "--format",
      "{{.Image}}",
      name,
    ]);
    if (imageId !== containerImage) throw Error("vault-service-image-mismatch");
    const upstream = await docker([
      "inspect",
      "--format",
      '{{range .Config.Env}}{{if eq (index (split . "=") 0) "EMULATOR_ARKD_URL"}}{{.}}{{end}}{{end}}',
      name,
    ]);
    if (upstream !== `EMULATOR_ARKD_URL=https://${network}.arkade.sh`)
      throw Error("vault-service-operator-mismatch");
    await docker([process.argv[2] === "restart" ? "restart" : "start", name]);
  } else {
    await vault.transaction(async (state) => {
      const secret = state.conditionalVaultServices[network].secret;
      await docker(
        [
          "run",
          "--detach",
          "--name",
          name,
          "--restart",
          "unless-stopped",
          "--publish",
          `127.0.0.1:${port}:7073`,
          "--read-only",
          "--cap-drop",
          "ALL",
          "--security-opt",
          "no-new-privileges",
          "--log-driver",
          "none",
          "--env",
          "EMULATOR_SECRET_KEY",
          "--env",
          "EMULATOR_LOG_LEVEL=1",
          "--env",
          `EMULATOR_ARKD_URL=https://${network}.arkade.sh`,
          "--env",
          "EMULATOR_PORT=7073",
          image,
        ],
        { ...process.env, EMULATOR_SECRET_KEY: secret },
      );
    });
  }
  let ready = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const response = await fetch(`${endpoint}/v1/info`, {
        signal: AbortSignal.timeout(2000),
      });
      const info = await response.json();
      const reported = String(info.signerPubkey).replace(/^(02|03)/, "");
      if (response.ok && reported === pin.publicKey) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw Error("vault-service-not-ready");
  process.stdout.write(
    JSON.stringify({
      network,
      endpoint,
      signerKey: pin.publicKey,
      commit,
      ready: true,
      fundedAcceptance: false,
    }) + "\n",
  );
} catch (error) {
  const reason =
    error instanceof Error &&
    /^(vault-service-[a-z-]+|vault-[a-z-]+)$/.test(error.message)
      ? error.message
      : "vault-service-unavailable";
  process.stdout.write(JSON.stringify({ ready: false, reason }) + "\n");
  process.exitCode = 1;
}
