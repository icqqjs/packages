import zod from "zod";
import { option } from "pastel";
import { IcqqGithubPackageFlow } from "@/components/IcqqGithubPackageFlow.js";

export const description = "升级 @icqqjs/icqq 到最新版本";

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

export default function Update({ options: cliOptions }: Props) {
  return (
    <IcqqGithubPackageFlow
      title="icqq update"
      mode="update"
      tokenOption={cliOptions.token}
      readyMessage="✓ @icqqjs/icqq 已是最新可用版本。"
      doneMessage="✓ 完成：@icqqjs/icqq 已升级。"
      retryCommand="icqq update"
    />
  );
}
