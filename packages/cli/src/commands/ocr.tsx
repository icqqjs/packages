import React from "react";
import { Text, Box } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "OCR 图片文字识别";

export const args = zod.tuple([
  zod.string().describe(argument({ name: "image", description: "图片文件路径" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function Ocr({ args: [image] }: Props) {
  return (
    <IpcCommand
      action={Actions.IMAGE_OCR}
      params={{ file: image }}
      loadingText="识别中…"
      render={(data: any) => (
        <Box flexDirection="column">
          {data.texts?.map((t: any, i: number) => (
            <Text key={i}>{t.text ?? t}</Text>
          )) ?? <Text>{JSON.stringify(data)}</Text>}
        </Box>
      )}
    />
  );
}
