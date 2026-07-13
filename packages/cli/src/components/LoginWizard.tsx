import React, { useState, useEffect } from "react";
import { Text, Box, useInput } from "ink";
import type { AccountConfig, IcqqConfig } from "@/lib/config.js";
import {
  findNetworkPortConflict,
  formatNetworkSetupSummary,
  pickAutoMcpPort,
  pickAutoRpcPort,
  resolveNetworkPortInput,
  type NetworkSetupChoice,
} from "@/lib/login-network-setup.js";
import {
  applyTextInputKey,
  moveSelectIndex,
  toggleBinaryIndex,
} from "@/lib/step-flow-input.js";
import {
  StepFlowCompleted,
  StepFlowFrame,
  StepFlowMaskedInput,
  StepFlowPrompt,
  StepFlowSection,
  StepFlowSelect,
  StepFlowTextInput,
  YES_NO_OPTIONS,
  type CompletedEntry,
} from "@/components/StepFlow.js";

export const LOGIN_PLATFORMS = [
  { value: 1, label: "Android" },
  { value: 2, label: "aPad" },
  { value: 3, label: "Watch" },
  { value: 4, label: "iMac" },
  { value: 5, label: "iPad" },
] as const;

export type LoginWizardResult = {
  qq?: number;
  platform: number;
  signApiUrl: string;
  ver: string;
  password?: string;
  network: NetworkSetupChoice;
};

export type LoginWizardProps = {
  onComplete: (result: LoginWizardResult) => void;
  initialQQ?: number;
  needPassword: boolean;
  savedAccount?: AccountConfig;
  networkDefaults: NetworkSetupChoice;
  firstNetworkSetup: boolean;
  appConfig: IcqqConfig;
  scopeUin?: number;
};

type WizardStep =
  | "qq"
  | "ask_password"
  | "password"
  | "platform"
  | "ver"
  | "sign_api"
  | "ask_mcp"
  | "mcp_port"
  | "mcp_token"
  | "ask_rpc"
  | "rpc_port"
  | "confirm";

const ASK_PW_OPTIONS = ["密码登录", "扫码登录"] as const;

export function LoginWizard({
  onComplete,
  initialQQ,
  needPassword,
  savedAccount,
  networkDefaults,
  firstNetworkSetup,
  appConfig,
  scopeUin,
}: LoginWizardProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [inputValue, setInputValue] = useState("");

  const [qq, setQQ] = useState(initialQQ ? String(initialQQ) : "");
  const [wantPassword, setWantPassword] = useState(needPassword);
  const [askPwIdx, setAskPwIdx] = useState(needPassword ? 0 : 1);
  const [password, setPassword] = useState("");
  const [platformIdx, setPlatformIdx] = useState(
    () => Math.max(0, LOGIN_PLATFORMS.findIndex((p) => p.value === (savedAccount?.platform ?? 1))),
  );
  const [platform, setPlatform] = useState(savedAccount?.platform ?? 1);
  const [ver, setVer] = useState(savedAccount?.ver ?? "");
  const [signApiUrl, setSignApiUrl] = useState(savedAccount?.signApiUrl ?? "");
  const [mcpEnabled, setMcpEnabled] = useState(networkDefaults.mcpEnabled);
  const [mcpPort, setMcpPort] = useState(networkDefaults.mcpPort);
  const [mcpToken, setMcpToken] = useState(networkDefaults.mcpToken);
  const [rpcEnabled, setRpcEnabled] = useState(networkDefaults.rpcEnabled);
  const [rpcPort, setRpcPort] = useState(networkDefaults.rpcPort);
  const [askMcpIdx, setAskMcpIdx] = useState(networkDefaults.mcpEnabled ? 0 : 1);
  const [askRpcIdx, setAskRpcIdx] = useState(networkDefaults.rpcEnabled ? 0 : 1);
  const [portError, setPortError] = useState("");

  const networkSteps: WizardStep[] = ["ask_mcp"];
  if (mcpEnabled) {
    networkSteps.push("mcp_port", "mcp_token");
  }
  networkSteps.push("ask_rpc");
  if (rpcEnabled) networkSteps.push("rpc_port");

  const validatePorts = (nextMcpPort: number, nextRpcPort: number): string | null =>
    findNetworkPortConflict(appConfig, scopeUin, {
      mcpEnabled,
      mcpPort: nextMcpPort,
      rpcEnabled,
      rpcPort: nextRpcPort,
    });

  const steps: WizardStep[] = [];
  if (!initialQQ) steps.push("qq");
  if (!needPassword) steps.push("ask_password");
  if (wantPassword || needPassword) steps.push("password");
  steps.push("platform", "ver", "sign_api", ...networkSteps, "confirm");

  const currentStep = steps[stepIdx]!;

  const advance = () => {
    setInputValue("");
    setStepIdx((prev) => prev + 1);
  };

  useInput((input, key) => {
    if (portError) setPortError("");

    if (currentStep === "ask_password" || currentStep === "ask_mcp" || currentStep === "ask_rpc") {
      const idx =
        currentStep === "ask_password"
          ? askPwIdx
          : currentStep === "ask_mcp"
            ? askMcpIdx
            : askRpcIdx;
      const setIdx =
        currentStep === "ask_password"
          ? setAskPwIdx
          : currentStep === "ask_mcp"
            ? setAskMcpIdx
            : setAskRpcIdx;

      if (key.upArrow || key.downArrow) {
        setIdx((prev) => toggleBinaryIndex(prev));
        return;
      }
      if (key.return) {
        if (currentStep === "ask_password") {
          setWantPassword(idx === 0);
        } else if (currentStep === "ask_mcp") {
          setMcpEnabled(idx === 0);
        } else {
          setRpcEnabled(idx === 0);
        }
        advance();
        return;
      }
      return;
    }

    if (currentStep === "platform") {
      if (key.upArrow) {
        setPlatformIdx((prev) => moveSelectIndex(prev, "up", LOGIN_PLATFORMS.length - 1));
        return;
      }
      if (key.downArrow) {
        setPlatformIdx((prev) => moveSelectIndex(prev, "down", LOGIN_PLATFORMS.length - 1));
        return;
      }
      if (key.return) {
        setPlatform(LOGIN_PLATFORMS[platformIdx]!.value);
        advance();
        return;
      }
      return;
    }

    if (currentStep === "confirm") {
      if (key.return) {
        const conflict = validatePorts(mcpPort, rpcPort);
        if (conflict) {
          setPortError(conflict);
          return;
        }
        onComplete({
          qq: qq ? Number(qq) : undefined,
          platform,
          signApiUrl,
          ver,
          password: password || undefined,
          network: {
            mcpEnabled,
            mcpToken,
            rpcEnabled,
            rpcHost: "127.0.0.1",
            mcpPort,
            rpcPort,
          },
        });
      }
      return;
    }

    const textResult = applyTextInputKey(inputValue, input, key);
    if (textResult.type === "append") {
      setInputValue(textResult.value);
      return;
    }
    if (textResult.type === "backspace") {
      setInputValue(textResult.value);
      return;
    }
    if (textResult.type !== "submit") return;

    if (currentStep === "qq") {
      setQQ(inputValue);
    } else if (currentStep === "ver") {
      setVer(inputValue);
    } else if (currentStep === "sign_api") {
      setSignApiUrl(inputValue);
    } else if (currentStep === "password") {
      setPassword(inputValue);
    } else if (currentStep === "mcp_port") {
      try {
        const next = resolveNetworkPortInput(inputValue, () =>
          pickAutoMcpPort(appConfig, scopeUin, rpcPort > 0 ? [rpcPort] : []),
        );
        const conflict = validatePorts(next, rpcPort);
        if (conflict) {
          setPortError(conflict);
          setInputValue("");
          return;
        }
        setMcpPort(next);
      } catch (e) {
        setPortError(e instanceof Error ? e.message : String(e));
        setInputValue("");
        return;
      }
    } else if (currentStep === "mcp_token") {
      setMcpToken(inputValue);
    } else if (currentStep === "rpc_port") {
      try {
        const next = resolveNetworkPortInput(inputValue, () =>
          pickAutoRpcPort(appConfig, scopeUin, mcpPort > 0 ? [mcpPort] : []),
        );
        const conflict = validatePorts(mcpPort, next);
        if (conflict) {
          setPortError(conflict);
          setInputValue("");
          return;
        }
        setRpcPort(next);
      } catch (e) {
        setPortError(e instanceof Error ? e.message : String(e));
        setInputValue("");
        return;
      }
    }
    advance();
  });

  useEffect(() => {
    if (currentStep === "sign_api" && savedAccount?.signApiUrl) {
      setInputValue(savedAccount.signApiUrl);
    }
    if (currentStep === "ver" && savedAccount?.ver) {
      setInputValue(savedAccount.ver);
    }
    if (currentStep === "mcp_port") {
      setInputValue(mcpPort === 0 ? "" : String(mcpPort));
    }
    if (currentStep === "mcp_token") {
      setInputValue(mcpToken);
    }
    if (currentStep === "rpc_port") {
      setInputValue(rpcPort === 0 ? "" : String(rpcPort));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在切换步骤时预填，冲突重试留在同一步不触发
  }, [currentStep]);

  const completedEntries: CompletedEntry[] = [];
  for (let i = 0; i < stepIdx; i++) {
    const s = steps[i]!;
    if (s === "qq") completedEntries.push(["QQ号", qq || "(扫码登录)"]);
    if (s === "ask_password") completedEntries.push(["登录方式", wantPassword ? "密码" : "扫码"]);
    if (s === "password") completedEntries.push(["密码", "●".repeat(password.length || 1)]);
    if (s === "platform") {
      const p = LOGIN_PLATFORMS.find((x) => x.value === platform);
      completedEntries.push(["平台", `${p?.label ?? platform}`]);
    }
    if (s === "ver") completedEntries.push(["协议版本", ver || "(默认)"]);
    if (s === "sign_api") completedEntries.push(["签名API", signApiUrl || "(无)"]);
    if (s === "ask_mcp") completedEntries.push(["MCP", mcpEnabled ? "启用" : "关闭"]);
    if (s === "mcp_port") {
      completedEntries.push([
        "MCP 端口",
        mcpPort === 0 ? "自动分配" : String(mcpPort),
      ]);
    }
    if (s === "mcp_token") {
      completedEntries.push(["MCP Token", mcpToken ? "已设置" : "(无)"]);
    }
    if (s === "ask_rpc") completedEntries.push(["RPC", rpcEnabled ? "启用" : "关闭"]);
    if (s === "rpc_port") {
      completedEntries.push([
        "RPC 端口",
        rpcPort === 0 ? "自动分配" : String(rpcPort),
      ]);
    }
  }

  const networkScopeHint = firstNetworkSetup
    ? "首次配置：开关/Token 写入全局，端口写入当前账号（留空自动选取不冲突端口）"
    : "写入当前账号 MCP/RPC（留空自动选取，填了则校验冲突）";

  const inNetworkSection =
    currentStep === "ask_mcp" ||
    currentStep === "ask_rpc" ||
    currentStep.startsWith("mcp_") ||
    currentStep.startsWith("rpc_");

  return (
    <StepFlowFrame
      title="━━ 登录配置 ━━"
      hint={savedAccount ? "已加载已保存配置，直接回车可使用默认值" : undefined}
    >
      <StepFlowCompleted entries={completedEntries} />

      {currentStep === "qq" && (
        <>
          <StepFlowPrompt label="QQ号" hint="(留空则扫码登录)" />
          <StepFlowTextInput value={inputValue} />
        </>
      )}

      {currentStep === "ask_password" && (
        <StepFlowSelect
          label="登录方式"
          hint="(↑↓选择, 回车确认)"
          options={ASK_PW_OPTIONS}
          selectedIndex={askPwIdx}
        />
      )}

      {currentStep === "password" && (
        <>
          <StepFlowPrompt label="请输入密码:" />
          <StepFlowMaskedInput value={inputValue} />
        </>
      )}

      {currentStep === "platform" && (
        <StepFlowSelect
          label="选择登录平台"
          hint="(↑↓选择, 回车确认):"
          options={LOGIN_PLATFORMS.map((p) => `${p.value}. ${p.label}`)}
          selectedIndex={platformIdx}
        />
      )}

      {currentStep === "ver" && (
        <>
          <StepFlowPrompt label="协议版本 (ver)" hint="(如 9.1.70，可留空使用默认):" />
          <StepFlowTextInput value={inputValue} />
        </>
      )}

      {currentStep === "sign_api" && (
        <>
          <StepFlowPrompt label="签名API地址" hint="(可留空跳过):" />
          <StepFlowTextInput value={inputValue} />
        </>
      )}

      {inNetworkSection && (
        <StepFlowSection title="━━ 网络服务（MCP / RPC）━━" hint={networkScopeHint} />
      )}

      {currentStep === "ask_mcp" && (
        <StepFlowSelect
          label="启用 MCP HTTP？"
          hint="（供 Cursor 等连接 QQ） (↑↓选择, 回车确认)"
          options={YES_NO_OPTIONS}
          selectedIndex={askMcpIdx}
        />
      )}

      {currentStep === "mcp_port" && (
        <>
          <StepFlowPrompt
            label="MCP 监听端口"
            hint="(留空或 0 = 自动选取不冲突端口):"
          />
          <StepFlowTextInput value={inputValue} />
        </>
      )}

      {currentStep === "mcp_token" && (
        <>
          <StepFlowPrompt label="MCP Bearer Token" hint="(可选，回车跳过):" />
          <StepFlowMaskedInput value={inputValue} char="•" />
        </>
      )}

      {currentStep === "ask_rpc" && (
        <StepFlowSelect
          label="启用 RPC TCP 远程连接？"
          hint="(↑↓选择, 回车确认；仅本机使用选「否」)"
          options={YES_NO_OPTIONS}
          selectedIndex={askRpcIdx}
        />
      )}

      {currentStep === "rpc_port" && (
        <>
          <StepFlowPrompt
            label="RPC 监听端口"
            hint="(留空或 0 = 自动选取不冲突端口):"
          />
          <StepFlowTextInput value={inputValue} />
        </>
      )}

      {portError ? <Text color="red">{portError}</Text> : null}

      {currentStep === "confirm" && (
        <Box marginTop={1} flexDirection="column">
          <Text>
            网络:{" "}
            {formatNetworkSetupSummary({
              mcpEnabled,
              mcpPort,
              mcpToken,
              rpcEnabled,
              rpcHost: "127.0.0.1",
              rpcPort,
            })}
          </Text>
          <Text bold color="yellow">
            按回车开始登录…
          </Text>
        </Box>
      )}
    </StepFlowFrame>
  );
}
