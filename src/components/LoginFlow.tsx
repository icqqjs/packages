import React, { useState, useEffect, useRef } from "react";
import { Text, Box, useInput } from "ink";
import type { Client } from "@icqqjs/icqq";
import { Spinner } from "./Spinner.js";
import { termLink } from "@/lib/parse-message.js";
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

type Props = {
  client: Client;
  dataDir: string;
  uin?: number;
  password?: string;
  onComplete: () => void;
  onError: (err: Error) => void;
};

export function LoginFlow({
  client,
  dataDir,
  uin,
  password,
  onComplete,
  onError,
}: Props) {
  const [phase, setPhase] = useState<LoginPhase>("connecting");
  const [detail, setDetail] = useState("正在连接…");
  const [inputValue, setInputValue] = useState("");
  const [qrPath, setQrPath] = useState("");
  const [verifyUrl, setVerifyUrl] = useState("");
  const [devicePhone, setDevicePhone] = useState("");
  const [inputMode, setInputMode] = useState<
    "ticket" | "sms" | "confirm" | null
  >(null);
  const disposedRef = useRef(false);

  const needsInput =
    phase === "qrcode" ||
    phase === "slider" ||
    (phase === "device" && inputMode !== null) ||
    phase === "auth";

  useInput(
    (input, key) => {
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
    { isActive: needsInput },
  );

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
      setQrPath(path.resolve(qrFile));
      setPhase("qrcode");
      setInputMode("confirm");
      setInputValue("");
    };

    const onSlider = (ev: { url: string }) => {
      if (disposedRef.current) return;
      setVerifyUrl(ev.url);
      setPhase("slider");
      setInputMode("ticket");
      setInputValue("");
    };

    const onDevice = (ev: { url: string; phone: string }) => {
      if (disposedRef.current) return;
      setVerifyUrl(ev.url);
      setDevicePhone(ev.phone);
      setPhase("device");
      setInputMode("confirm");
      setInputValue("");
    };

    const onAuth = (ev: { url: string }) => {
      if (disposedRef.current) return;
      setVerifyUrl(ev.url);
      setPhase("auth");
      setInputMode("confirm");
      setInputValue("");
    };

    const onQrcodeWrapper = (ev: any) => void onQrcode(ev);
    client.on("system.online", onOnline);
    client.on("system.login.error", onLoginError);
    client.on("system.login.qrcode", onQrcodeWrapper);
    client.on("system.login.slider", onSlider);
    client.on("system.login.device", onDevice);
    client.on("system.login.auth", onAuth);

    // Start login
    void (async () => {
      try {
        if (uin && password) {
          await client.login(uin, password);
        } else if (uin) {
          setDetail("尝试 token 登录，若 token 过期将跳转验证…");
          await client.login(uin);
        } else {
          setDetail("等待扫码登录…");
          await client.login();
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
      client.off("system.online");
      client.off("system.login.error");
      client.off("system.login.qrcode");
      client.off("system.login.slider");
      client.off("system.login.device");
      client.off("system.login.auth");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (value: string) => {
    const trimmed = value.trim();
    setInputValue("");

    if (phase === "qrcode") {
      setInputMode(null);
      setPhase("connecting");
      setDetail("正在验证扫码结果…");
      await client.login();
    } else if (phase === "slider") {
      if (!trimmed) return;
      setInputMode(null);
      setPhase("connecting");
      setDetail("正在提交滑块验证…");
      try {
        await client.submitSlider(trimmed);
      } catch {
        await client.login();
      }
    } else if (phase === "device" && inputMode === "sms") {
      if (!trimmed) return;
      setInputMode(null);
      setPhase("connecting");
      setDetail("正在提交短信验证码…");
      try {
        await client.submitSmsCode(trimmed);
      } catch {
        await client.login();
      }
    } else if (phase === "device" && inputMode === "confirm") {
      if (trimmed.toLowerCase() === "sms" && devicePhone) {
        await client.sendSmsCode();
        setInputMode("sms");
        setInputValue("");
        return;
      }
      setInputMode(null);
      setPhase("connecting");
      setDetail("正在继续登录…");
      await client.login();
    } else if (phase === "auth") {
      setInputMode(null);
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
          <Text>
            二维码已保存到:{" "}
            <Text color="cyan">{qrPath}</Text>
          </Text>
          {process.platform === "darwin" && (
            <Text dimColor>macOS 可执行: open &quot;{qrPath}&quot;</Text>
          )}
          <Text>
            请打开手机 QQ → 右上角加号 / 扫一扫，在手机上确认登录
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
          <Box marginTop={1}>
            <Text color="green">粘贴 ticket: </Text>
            <Text>
              {inputValue}
              <Text color="cyan">█</Text>
            </Text>
          </Box>
        </Box>
      )}

      {phase === "device" && (
        <Box flexDirection="column">
          <Text bold color="yellow">
            ━━ 设备锁验证 ━━
          </Text>
          {devicePhone && <Text>密保手机: {devicePhone}</Text>}
          <Text>
            验证链接:{" "}
            <Text color="cyan">{termLink(verifyUrl, verifyUrl)}</Text>
          </Text>
          {inputMode === "confirm" && (
            <Box flexDirection="column" marginTop={1}>
              <Text>
                在浏览器完成验证后按回车{devicePhone ? "，或输入 sms 发送短信" : ""}
              </Text>
              <Box marginTop={1}>
                <Text color="green">输入: </Text>
                <Text>
                  {inputValue}
                  <Text color="cyan">█</Text>
                </Text>
              </Box>
            </Box>
          )}
          {inputMode === "sms" && (
            <Box marginTop={1}>
              <Text color="green">请输入短信验证码: </Text>
              <Text>
                {inputValue}
                <Text color="cyan">█</Text>
              </Text>
            </Box>
          )}
        </Box>
      )}

      {phase === "auth" && (
        <Box flexDirection="column">
          <Text bold color="yellow">
            ━━ 身份验证 ━━
          </Text>
          <Text>
            请在浏览器打开:{" "}
            <Text color="cyan">{termLink(verifyUrl, verifyUrl)}</Text>
          </Text>
          <Box marginTop={1}>
            <Text color="green">完成验证后按回车: </Text>
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
