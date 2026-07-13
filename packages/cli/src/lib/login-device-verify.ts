export type DeviceVerifyOption = "sms" | "url";

export type DeviceVerifyChoiceItem = {
  id: DeviceVerifyOption;
  label: string;
};

/** 设备锁验证方式选项；无手机号时仅 URL */
export function buildDeviceVerifyOptions(
  phone: string,
): DeviceVerifyChoiceItem[] {
  const options: DeviceVerifyChoiceItem[] = [];
  if (phone.trim()) {
    options.push({
      id: "sms",
      label: `手机号验证（密保手机 ${phone.trim()}）`,
    });
  }
  options.push({
    id: "url",
    label: "浏览器打开链接验证",
  });
  return options;
}

/** 有手机号时需选择；无手机号时直接进入 URL 流程 */
export function shouldShowDeviceVerifyChooser(phone: string): boolean {
  return Boolean(phone.trim());
}
