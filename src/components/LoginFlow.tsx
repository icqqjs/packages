import React, { useState, useEffect, useRef, useMemo } from "react";
import { Text, Box, useInput } from "ink";
import type { Client } from "@icqqjs/icqq";
import { spawn } from "node:child_process";
import { Spinner } from "./Spinner.js";
import { termLink } from "@/lib/parse-message.js";
import { renderQrcodeAscii } from "@/lib/render-qrcode.js";
import {
  AUTH_DEVICE_FILENAME,
  AUTH_DEVICE_INJECT_SCRIPT,
  AUTH_DEVICE_STEPS,
  formatAuthDeviceJson,
  formatAuthDeviceOneLine,
} from "@/lib/login-auth-guide.js";
import {
  buildDeviceVerifyOptions,
  shouldShowDeviceVerifyChooser,
  type DeviceVerifyOption,
} from "@/lib/login-device-verify.js";
import { bindInteractiveLoginHandlers } from "@/lib/account-bootstrap.js";
import fs from "node:fs/promises";
import path from "node:path";

type LoginPhase =
  | "connecting"
  | "qrcode"
  | "slider"
  | "device"
  | "auth"
  | "online"
  | "error";

type DeviceVerifyMode = "choose" | "url" | "sms";

type Props = {
  client: Client;
  dataDir: string;
  uin?: number;
  password?: string;
  /** 用户选择扫码登录（无密码）时跳过 token，直接拉二维码 */
  qrOnly?: boolean;
  onComplete: () => void;
  onError: (err: Error) => void;
};

export function LoginFlow({
  client,
  dataDir,
  uin,
  password,
  qrOnly = false,
  onComplete,
  onError,
}: Props) {
  const [phase, setPhase] = useState<LoginPhase>("connecting");
  const [detail, setDetail] = useState("正在连接…");
  const [inputValue, setInputValue] = useState("");
  const [qrPath, setQrPath] = useState("");
  const [qrLines, setQrLines] = useState<string[]>([]);
  const [verifyUrl, setVerifyUrl] = useState("");
  const [devicePhone, setDevicePhone] = useState("");
  const [deviceVerifyMode, setDeviceVerifyMode] = useState<DeviceVerifyMode>("choose");
  const [deviceChooseIdx, setDeviceChooseIdx] = useState(0);
  const [deviceJson, setDeviceJson] = useState("");
  const [deviceJsonOneLine, setDeviceJsonOneLine] = useState("");
  const [deviceJsonPath, setDeviceJsonPath] = useState("");
  const [phaseError, setPhaseError] = useState("");
  const disposedRef = useRef(false);

  const deviceVerifyOptions = useMemo(
    () => buildDeviceVerifyOptions(devicePhone),
    [devicePhone],
  );

  const needsTextInput =
    phase === "qrcode" ||
    phase === "slider" ||
    (phase === "device" && deviceVerifyMode === "sms") ||
    (phase === "device" && deviceVerifyMode === "url") ||
    phase === "auth";

  const needsChooserInput = phase === "device" && deviceVerifyMode === "choose";

  useInput(
    (input, key) => {
      if (phaseError) setPhaseError("");

      if (needsChooserInput) {
        if (key.upArrow) {
          setDeviceChooseIdx((prev) =>
            Math.max(0, prev - 1),
          );
          return;
        }
        if (key.downArrow) {
          setDeviceChooseIdx((prev) =>
            Math.min(deviceVerifyOptions.length - 1, prev + 1),
          );
          return;
        }
        if (key.return) {
          void applyDeviceVerifyChoice(
            deviceVerifyOptions[deviceChooseIdx]!.id,
          );
        }
        return;
      }

      if (phase === "device" && deviceVerifyMode !== "choose") {
        if (key.escape || (key.backspace && inputValue === "")) {
          if (shouldShowDeviceVerifyChooser(devicePhone)) {
            setDeviceVerifyMode("choose");
            setDeviceChooseIdx(0);
            setInputValue("");
            setPhaseError("");
          }
          return;
        }
      }

      if (key.return) {
        void handleSubmit(inputValue);
        return;
      }
      if (key.backspace || key.delete) {
        setInputValue((prev) => prev.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setInputValue((prev) => prev + input);
      }
    },
    { isActive: needsTextInput || needsChooserInput },
  );

  const applyDeviceVerifyChoice = async (choice: DeviceVerifyOption) => {
    setPhaseError("");
    setInputValue("");
    if (choice === "sms") {
      try {
        await client.sendSmsCode();
        setDeviceVerifyMode("sms");
      } catch (e) {
        setPhaseError(
          e instanceof Error ? e.message : "发送短信验证码失败，请重试",
        );
      }
      return;
    }
    setDeviceVerifyMode("url");
  };

  useEffect(() => {
    const onOnline = () => {
      if (disposedRef.current) return;
      setPhase("online");
      setDetail(`QQ ${client.uin} 已上线`);
      setTimeout(() => onComplete(), 500);
    };

    const onLoginError = (e: { code?: number; message: string }) => {
      if (disposedRef.current) return;
      setPhase("error");
      const msg = `${e.message}${e.code !== undefined ? ` [code=${e.code}]` : ""}`;
      setDetail(msg);
      onError(new Error(msg));
    };

    const onQrcode = async (ev: { image: Buffer }) => {
      if (disposedRef.current) return;
      const qrFile = path.join(dataDir, "qrcode.png");
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(qrFile, ev.image);
      const resolved = path.resolve(qrFile);
      setQrPath(resolved);
      setQrLines(renderQrcodeAscii(ev.image));
      setPhase("qrcode");
      setInputValue("");
      if (process.platform === "darwin") {
        spawn("open", [resolved], { detached: true, stdio: "ignore" }).unref();
      }
    };

    const onSlider = (ev: { url: string }) => {
      if (disposedRef.current) return;
      setVerifyUrl(ev.url);
      setPhase("slider");
      setInputValue("");
      setPhaseError("");
    };

    const onDevice = (ev: { url: string; phone: string }) => {
      if (disposedRef.current) return;
      setVerifyUrl(ev.url);
      setDevicePhone(ev.phone);
      setPhase("device");
      setDeviceChooseIdx(0);
      setDeviceVerifyMode(
        shouldShowDeviceVerifyChooser(ev.phone) ? "choose" : "url",
      );
      setInputValue("");
      setPhaseError("");
    };

    const onAuth = async (ev: { url: string; device?: unknown }) => {
      if (disposedRef.current) return;
      setVerifyUrl(ev.url);
      const formatted = formatAuthDeviceJson(ev.device);
      const oneLine = formatAuthDeviceOneLine(ev.device);
      const filePath = path.join(dataDir, AUTH_DEVICE_FILENAME);
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(filePath, `${formatted}\n`, "utf-8");
      setDeviceJson(formatted);
      setDeviceJsonOneLine(oneLine);
      setDeviceJsonPath(path.resolve(filePath));
      setPhase("auth");
      setInputValue("");
      setPhaseError("");
    };

    const dispose = bindInteractiveLoginHandlers(client, {
      onOnline: onOnline,
      onLoginError: onLoginError,
      onQrcode: (ev) => void onQrcode(ev as { image: Buffer }),
      onSlider: onSlider,
      onDevice: onDevice,
      onAuth: onAuth,
    });

    void (async () => {
      try {
        if (uin && password) {
          await client.login(uin, password);
        } else if (qrOnly || !uin) {
          setDetail("等待扫码登录…");
          await client.login();
        } else {
          setDetail("尝试 token 登录，若 token 过期将跳转验证…");
          await client.login(uin);
        }
      } catch (e) {
        if (!disposedRef.current) {
          setPhase("error");
          const msg = e instanceof Error ? e.message : String(e);
          setDetail(msg);
          onError(e instanceof Error ? e : new Error(msg));
        }
      }
    })();

    return () => {
      disposedRef.current = true;
      dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (value: string) => {
    const trimmed = value.trim();
    setInputValue("");

    if (phase === "qrcode") {
      setPhase("connecting");
      setDetail("正在验证扫码结果…");
      await client.login();
    } else if (phase === "slider") {
      if (!trimmed) return;
      setPhase("connecting");
      setDetail("正在提交滑块验证…");
      try {
        await client.submitSlider(trimmed);
      } catch (e) {
        setPhase("slider");
        setPhaseError(
          e instanceof Error ? e.message : "ticket 无效，请重试",
        );
      }
    } else if (phase === "device" && deviceVerifyMode === "sms") {
      if (!trimmed) return;
      setPhase("connecting");
      setDetail("正在提交短信验证码…");
      try {
        await client.submitSmsCode(trimmed);
      } catch (e) {
        setPhase("device");
        setDeviceVerifyMode("sms");
        setPhaseError(
          e instanceof Error ? e.message : "验证码无效，请重试",
        );
      }
    } else if (phase === "device" && deviceVerifyMode === "url") {
      setPhase("connecting");
      setDetail("正在继续登录…");
      await client.login();
    } else if (phase === "auth") {
      setPhase("connecting");
      setDetail("正在继续登录…");
      await client.login();
    }
  };

  return (
    <Box flexDirection="column" paddingX={1}>
      {phase === "connecting" && <Spinner label={detail} />}

      {phase === "qrcode" && (
        <Box flexDirection="column">
          <Text bold color="yellow">
            ━━ 扫码登录 ━━
          </Text>
          <Box flexDirection="column" marginY={1}>
            {qrLines.map((line, i) => (
              <Text key={i}>{line}</Text>
            ))}
          </Box>
          <Text dimColor>
            二维码文件: <Text color="cyan">{qrPath}</Text>
            {process.platform === "darwin" ? "（已尝试用预览打开）" : ""}
          </Text>
          <Text>
            请打开手机 QQ → 扫一扫，在手机上确认登录
          </Text>
          <Box marginTop={1}>
            <Text color="green">确认后按回车继续: </Text>
            <Text>
              {inputValue}
              <Text color="cyan">█</Text>
            </Text>
          </Box>
        </Box>
      )}

      {phase === "slider" && (
        <Box flexDirection="column">
          <Text bold color="yellow">
            ━━ 滑块验证 ━━
          </Text>
          <Text>
            请在浏览器打开:{" "}
            <Text color="cyan">{termLink(verifyUrl, verifyUrl)}</Text>
          </Text>
          <Text>
            完成验证后取出 ticket（若需 randStr 用英文逗号隔开）
          </Text>
          {phaseError ? <Text color="red">{phaseError}</Text> : null}
          <Box marginTop={1}>
            <Text color="green">粘贴 ticket: </Text>
            <Text>
              {inputValue}
              <Text color="cyan">█</Text>
            </Text>
          </Box>
        </Box>
      )}

      {phase === "device" && deviceVerifyMode === "choose" && (
        <Box flexDirection="column">
          <Text bold color="yellow">
            ━━ 设备锁验证 ━━
          </Text>
          <Text>请选择验证方式 <Text dimColor>(↑↓选择, 回车确认)</Text></Text>
          {deviceVerifyOptions.map((opt, i) => (
            <Text key={opt.id}>
              <Text color={i === deviceChooseIdx ? "cyan" : undefined}>
                {i === deviceChooseIdx ? "❯ " : "  "}
                {opt.label}
              </Text>
            </Text>
          ))}
          {phaseError ? <Text color="red">{phaseError}</Text> : null}
        </Box>
      )}

      {phase === "device" && deviceVerifyMode === "url" && (
        <Box flexDirection="column">
          <Text bold color="yellow">
            ━━ 设备锁验证 · 浏览器链接 ━━
          </Text>
          <Text>
            请在浏览器打开并完成验证:{" "}
            <Text color="cyan">{termLink(verifyUrl, verifyUrl)}</Text>
          </Text>
          {shouldShowDeviceVerifyChooser(devicePhone) ? (
            <Text dimColor>按 Esc 或 Backspace 返回重选验证方式</Text>
          ) : null}
          {phaseError ? <Text color="red">{phaseError}</Text> : null}
          <Box marginTop={1}>
            <Text color="green">完成后按回车继续: </Text>
            <Text>
              {inputValue}
              <Text color="cyan">█</Text>
            </Text>
          </Box>
        </Box>
      )}

      {phase === "device" && deviceVerifyMode === "sms" && (
        <Box flexDirection="column">
          <Text bold color="yellow">
            ━━ 设备锁验证 · 手机短信 ━━
          </Text>
          {devicePhone ? <Text>密保手机: {devicePhone}</Text> : null}
          <Text dimColor>验证码已发送至密保手机</Text>
          <Text dimColor>按 Esc 或 Backspace 返回重选验证方式</Text>
          {phaseError ? <Text color="red">{phaseError}</Text> : null}
          <Box marginTop={1}>
            <Text color="green">请输入短信验证码: </Text>
            <Text>
              {inputValue}
              <Text color="cyan">█</Text>
            </Text>
          </Box>
        </Box>
      )}

      {phase === "auth" && (
        <Box flexDirection="column">
          <Text bold color="yellow">
            ━━ 身份验证（237） ━━
          </Text>
          <Text>
            验证链接:{" "}
            <Text color="cyan">{termLink(verifyUrl, verifyUrl)}</Text>
          </Text>
          {deviceJsonPath ? (
            <Text dimColor>
              设备信息已写入: <Text color="cyan">{deviceJsonPath}</Text>
            </Text>
          ) : null}

          <Box flexDirection="column" marginTop={1}>
            <Text bold>【操作步骤】</Text>
            {AUTH_DEVICE_STEPS.map((step, i) => (
              <Text key={step}>
                {i + 1}. {step}
              </Text>
            ))}
          </Box>

          {deviceJson ? (
            <Box flexDirection="column" marginTop={1}>
              <Text bold>【设备信息 JSON】</Text>
              {deviceJson.split("\n").map((line, i) => (
                <Text key={`${i}-${line}`} dimColor>
                  {line}
                </Text>
              ))}
            </Box>
          ) : null}

          {deviceJsonOneLine ? (
            <Box flexDirection="column" marginTop={1}>
              <Text bold>【单行 JSON（弹窗粘贴）】</Text>
              <Text wrap="wrap">{deviceJsonOneLine}</Text>
            </Box>
          ) : null}

          <Box flexDirection="column" marginTop={1}>
            <Text bold>【控制台 JS】</Text>
            {AUTH_DEVICE_INJECT_SCRIPT.split("\n").map((line, i) => (
              <Text key={`js-${i}-${line}`} dimColor>
                {line}
              </Text>
            ))}
          </Box>

          <Box marginTop={1}>
            <Text color="green">完成上述步骤后按回车: </Text>
            <Text>
              {inputValue}
              <Text color="cyan">█</Text>
            </Text>
          </Box>
        </Box>
      )}

      {phase === "online" && (
        <Text color="green">✔ {detail}</Text>
      )}

      {phase === "error" && (
        <Text color="red">✖ {detail}</Text>
      )}
    </Box>
  );
}
