import type { Content, LetterContent } from "./types";

/**
 * 归一化旧版数据:
 * - 旧版单封信 letter → 迁移为双向信墙 letters 数组
 * - 为缺失 id 的信件补 id
 * 保证 v1 仓库数据推送上来后也能直接编辑
 */
export function normalizeContent(raw: any): Content {
  const c = { ...raw };

  if (Array.isArray(c.letters) && c.letters.length > 0) {
    c.letters = c.letters.map((l: any, i: number) => ({
      id: l.id ?? `l${i + 1}`,
      title: l.title ?? "一封信",
      content: l.content ?? "",
      from: l.from ?? "",
      to: l.to ?? "",
      date: l.date ?? "",
    })) as LetterContent[];
  } else if (c.letter) {
    c.letters = [{ id: "l1", ...c.letter }];
  } else {
    c.letters = [];
  }
  delete c.letter;

  // 字段兜底
  c.site = c.site ?? ({} as any);
  c.timeline = c.timeline ?? [];
  c.photos = c.photos ?? [];
  c.quotes = c.quotes ?? [];
  c.wishes = c.wishes ?? [];

  return c as Content;
}
