export interface Profile {
  name: string;
  nickname: string;
  signature: string;
  avatar: string;
  birthday: string;
  role: string;
  /** 个人标签,如 "咖啡脑袋" "夜猫子" */
  tags: string[];
  /** 自我介绍 */
  about: string;
}

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  content: string;
  photo: string;
}

export interface Photo {
  id: string;
  url: string;
  title: string;
  group: string;
}

export interface Quote {
  id: string;
  text: string;
  author: string;
  date: string;
}

export interface Wish {
  id: string;
  text: string;
  done: boolean;
}

export interface GiscusConfig {
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
}

export interface SiteConfig {
  title: string;
  subtitle: string;
  heroQuote: string;
  heroNote: string;
  metDate: string;
  musicUrl: string;
  musicTitle: string;
  giscus: GiscusConfig;
  updatedAt: string;
  /** 编辑口令的 SHA-256(十六进制),为空表示未设置 */
  editPassHash?: string;
}

/** 一封信:双向信墙中,两人各写各的 */
export interface LetterContent {
  id: string;
  title: string;
  content: string;
  from: string;
  to: string;
  date: string;
}

export interface Content {
  site: SiteConfig;
  me: Profile;
  friend: Profile;
  timeline: TimelineEvent[];
  photos: Photo[];
  quotes: Quote[];
  wishes: Wish[];
  letters: LetterContent[];
}
