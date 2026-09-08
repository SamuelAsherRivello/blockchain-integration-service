## 1. Transaction Detail implementation

- [x] 1.1 Update AccountActivity to show exactly View Recovery Info, Open On Explorer, and Back in order, removing TransactionRecovery actions from this view while retaining report copying and list navigation.
- [x] 1.2 Keep recovery visible but disabled without a selected recovery report; preserve secret-free selected-operation reporting and remove the bottom explorer paragraph with an accessible disabled-control reason.

## 2. Recovery Info implementation

- [x] 2.1 Render the separate recovery dialog with shared production card, report and copy-label styling, Recovery Info title and label, inline copy icon, and only Back in the footer.
- [x] 2.2 Implement Back closure, intact source selection, cleanup, copy success/failure, focus containment and Escape dismissal, and internally scrolling report without introducing wallet actions.

## 3. Verification after implementation

- [x] 3.1 Update existing activity/recovery browser checks for exact action counts and labels, ordinary records, disabled Explorer, removed bottom text, selected report copy, Back, clipboard failure and no browser window creation; confirm no status checks or wallet mutations occur during viewing.
- [x] 3.2 Run relevant integration and demo checks and the production build; inspect actual detail and recovery dialogs in a browser at compact/narrow dimensions and built-demo styling, recording results without secrets.

