/**
 * For buttons that call the server: if the internet drops, the sign-in has run out, or an old tab
 * calls the server after an update, the call throws. `.catch(netFail)` turns that into a normal
 * "Couldn't save" answer, so the button shows a message instead of freezing or showing an error page.
 */
export const NET_ERROR = "Couldn't save — check the internet and try again.";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const netFail = (): any => ({ error: NET_ERROR });
