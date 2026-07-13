/** 门控 login IPC actions（不进入主 ACTION_CATALOG） */
export const LoginActions = {
  LOGIN_GET_STATE: "login_get_state",
  LOGIN_SUBMIT: "login_submit",
  LOGIN_SEND_SMS: "login_send_sms",
} as const;

export const LOGIN_ACTION_VALUES = Object.values(LoginActions) as string[];

export function isLoginAction(action: string): boolean {
  return (LOGIN_ACTION_VALUES as string[]).includes(action);
}
