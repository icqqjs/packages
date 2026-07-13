import zod from "zod";
import { option } from "pastel";
import { IcqqGithubPackageFlow } from "@/components/IcqqGithubPackageFlow.js";

export const description = "检查并安装 @icqqjs/icqq 依赖（不修改 ~/.npmrc）";

export const options = zod.object({
  token: zod
    .string()
    .optional()
    .describe(
      option({
        description:
          "GitHub PAT（read:packages）；未提供时将交互输入、读取环境变量或 ~/.icqq/github.token",
        alias: "t",
      }),
    ),
});

type Props = {
  options: zod.infer<typeof options>;
};

export default function Setup({ options: cliOptions }: Props) {
  return (
    <IcqqGithubPackageFlow
      title="icqq setup"
      mode="setup"
      tokenOption={cliOptions.token}
      readyMessage="✓ 完成：@icqqjs/icqq 已可正常加载。"
      doneMessage="✓ 完成：可以运行 icqq login 了。"
      retryCommand="icqq setup"
    />
  );
}
