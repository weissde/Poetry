import { Link } from"react-router-dom";
import { SectionCard } from"@/components/common/SectionCard";
import { VirtualizedList } from"@/components/common/VirtualizedList";
import type { FavoritePoemItem } from"@/types";

interface FavoritesPanelProps {
 favoritePage: number;
 favoritePageSize: number;
 favoriteTotal: number;
 favoriteTotalPages: number;
 favoriteKeyword: string;
 favoriteAppliedKeyword: string;
 favoritesLoading: boolean;
 favoritesError: string | null;
 favoriteItems: FavoritePoemItem[];
 favoriteNoteDrafts: Record<string, string>;
 favoriteNoteMessages: Record<string, string>;
 favoriteNoteSavingId: string | null;
 unfavoriteLoadingId: string | null;
 setFavoriteKeyword: (value: string) => void;
 setFavoritePage: (value: number | ((prev: number) => number)) => void;
 setFavoritePageSize: (value: number) => void;
 setFavoriteNoteDrafts: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
 setFavoriteNoteMessages: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
 loadFavorites: (filters?: {
 page?: number;
 pageSize?: number;
 keyword?: string;
 force?: boolean;
 }) => void | Promise<void>;
 saveFavoriteNote: (poemId: string) => void | Promise<void>;
 unfavoritePoem: (poemId: string) => void | Promise<void>;
}

export function FavoritesPanel({
 favoritePage,
 favoritePageSize,
 favoriteTotal,
 favoriteTotalPages,
 favoriteKeyword,
 favoriteAppliedKeyword,
 favoritesLoading,
 favoritesError,
 favoriteItems,
 favoriteNoteDrafts,
 favoriteNoteMessages,
 favoriteNoteSavingId,
 unfavoriteLoadingId,
 setFavoriteKeyword,
 setFavoritePage,
 setFavoritePageSize,
 setFavoriteNoteDrafts,
 setFavoriteNoteMessages,
 loadFavorites,
 saveFavoriteNote,
 unfavoritePoem,
}: FavoritesPanelProps): JSX.Element {
 return (
 <section className="flow-md">
 <SectionCard
 title="我的收藏诗集"
 subtitle="这里会同步展示你在学习页收藏的诗词与笔记。"
 className="surface-card"
 bodyClassName="flow-md"
 actions={
 <button
 type="button"
 onClick={() =>
 void loadFavorites({
 page: favoritePage,
 pageSize: favoritePageSize,
 keyword: favoriteAppliedKeyword,
 force: true,
 })
 }
 className="btn-secondary"
 >
 刷新
 </button>
 }
 >
 <div className="mt-4 flex items-center gap-2">
 <input
 value={favoriteKeyword}
 onChange={(event) => setFavoriteKeyword(event.target.value)}
 onKeyDown={(event) => {
 if (event.key ==="Enter") {
 event.preventDefault();
 setFavoritePage(1);
 void loadFavorites({
 page: 1,
 pageSize: favoritePageSize,
 keyword: favoriteKeyword,
 });
 }
 }}
 placeholder="搜索诗名、作者、朝代、内容或笔记"
 className="input-main control-dense w-full"
 />
 <button
 type="button"
 onClick={() => {
 setFavoritePage(1);
 void loadFavorites({
 page: 1,
 pageSize: favoritePageSize,
 keyword: favoriteKeyword,
 });
 }}
 className="btn-secondary"
 >
 搜索
 </button>
 <button
 type="button"
 onClick={() => {
 setFavoriteKeyword("");
 setFavoritePage(1);
 void loadFavorites({
 page: 1,
 pageSize: favoritePageSize,
 keyword:"",
 });
 }}
 className="btn-secondary"
 >
 清空
 </button>
 </div>
 </SectionCard>

 {favoritesError ? <div className="rounded-xl shadow-[inset_0_0_0_1px_rgba(239,68,68,0.24)] bg-red-50 p-4 text-sm text-red-700">{favoritesError}</div> : null}

 {favoritesLoading ? (
 <div className="rounded-xl shadow-[inset_0_0_0_1px_rgba(26,43,76,0.14)] bg-slate-50/50 p-10 text-center text-slate-500">正在加载收藏...</div>
 ) : null}

 {!favoritesLoading && favoriteItems.length === 0 ? (
 <div className="rounded-xl shadow-[inset_0_0_0_1px_rgba(26,43,76,0.14)] bg-slate-50/50 p-10 text-center text-slate-500">
 <p>
 {favoriteAppliedKeyword
 ?"没有匹配到关键词，换一个词再试试。"
 :"你还没有收藏诗词，先去学习页点一下“收藏诗词”。"}
 </p>
 <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
 {favoriteAppliedKeyword ? (
 <button
 type="button"
 onClick={() => {
 setFavoriteKeyword("");
 setFavoritePage(1);
 void loadFavorites({
 page: 1,
 pageSize: favoritePageSize,
 keyword:"",
 });
 }}
 className="btn-secondary-compact"
 >
 清空筛选
 </button>
 ) : null}
 <Link to="/explore" className="btn-primary-compact">
 去探索诗词
 </Link>
 <Link to="/learn" className="btn-secondary-compact">
 去学习页
 </Link>
 </div>
 </div>
 ) : null}

 {!favoritesLoading && favoriteItems.length > 0 ? (
 <div className="rounded-xl shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-slate-50/50 px-3 py-2">
 <div className="flex items-center justify-between">
 <p className="text-xs text-slate-600">
 第 {favoritePage}/{favoriteTotalPages} 页 · 共 {favoriteTotal} 首
 </p>
 <div className="flex items-center gap-2">
 <select
 value={favoritePageSize}
 onChange={(event) => {
 setFavoritePageSize(Number(event.target.value));
 setFavoritePage(1);
 }}
 className="input-main control-compact"
 >
 <option value={8}>8 / 页</option>
 <option value={12}>12 / 页</option>
 <option value={20}>20 / 页</option>
 </select>
 <button
 type="button"
 disabled={favoritePage <= 1}
 onClick={() => setFavoritePage((prev) => Math.max(1, prev - 1))}
 className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-50"
 >
 上一页
 </button>
 <button
 type="button"
 disabled={favoritePage >= favoriteTotalPages}
 onClick={() => setFavoritePage((prev) => Math.min(favoriteTotalPages, prev + 1))}
 className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-50"
 >
 下一页
 </button>
 </div>
 </div>
 </div>
 ) : null}

 {!favoritesLoading && favoriteItems.length > 0 ? (
 <VirtualizedList
 items={favoriteItems}
 getKey={(item) => item.poemId}
 height={860}
 estimateHeight={420}
 overscan={3}
 renderItem={(item) => {
 const savedNote = item.note ||"";
 const draftNote = favoriteNoteDrafts[item.poemId] ?? savedNote;
 const noteChanged = draftNote !== savedNote;
 const noteSaving = favoriteNoteSavingId === item.poemId;
 const noteMessage = favoriteNoteMessages[item.poemId];

 return (
 <div className="pb-4">
 <article className="surface-card">
 <div className="flex items-start justify-between gap-3">
 <div>
 <h3 className="font-display text-xl text-ink-700">{item.poem?.title ||"未命名诗词"}</h3>
 <p className="mt-1 text-xs text-slate-500">
 {item.poem?.author ||"未知作者"} · {item.poem?.dynasty ||"未知朝代"}
 </p>
 </div>
 <span className="rounded-full bg-ink-50 px-3 py-1 text-xs text-ink-700">
 收藏于 {new Date(item.favoritedAt).toLocaleDateString()}
 </span>
 </div>

 <p className="mt-3 line-clamp-4 text-sm leading-7 text-slate-700">{item.poem?.content ||""}</p>

 <div className="mt-3 rounded-lg bg-warm-50 p-3">
 <div className="flex items-center justify-between gap-3">
 <p className="text-xs text-slate-500">学习笔记（支持直接编辑）</p>
 <span className="text-[11px] text-slate-500">{draftNote.length}/4000</span>
 </div>
 <textarea
 value={draftNote}
 onChange={(event) => {
 const next = event.target.value.slice(0, 4000);
 setFavoriteNoteDrafts((prev) => ({ ...prev, [item.poemId]: next }));
 setFavoriteNoteMessages((prev) => {
 if (!prev[item.poemId]) {
 return prev;
 }
 const copy = { ...prev };
 delete copy[item.poemId];
 return copy;
 });
 }}
 rows={4}
 placeholder="可记录关键词、易错点、自己的理解。"
 className="mt-2 w-full rounded-lg shadow-[inset_0_0_0_1px_rgba(201,169,110,0.20)] bg-white px-3 py-2 text-sm leading-7 text-slate-700 outline-none transition focus:shadow-[inset_0_0_0_1px_rgba(26,43,76,0.38)]"
 />
 {item.noteUpdatedAt ? (
 <p className="mt-2 text-[11px] text-slate-500">最近更新：{new Date(item.noteUpdatedAt).toLocaleString()}</p>
 ) : null}
 {noteMessage ? (
 <p className="mt-2 rounded-lg shadow-[inset_0_0_0_1px_rgba(34,197,94,0.24)] bg-green-50 px-2 py-1 text-xs text-green-700">{noteMessage}</p>
 ) : null}
 <div className="mt-2 flex flex-wrap gap-2">
 <button
 type="button"
 onClick={() => void saveFavoriteNote(item.poemId)}
 disabled={noteSaving || !noteChanged}
 className="btn-primary-compact disabled:cursor-not-allowed disabled:opacity-60"
 >
 {noteSaving ?"保存中..." :"保存笔记"}
 </button>
 <button
 type="button"
 onClick={() => {
 setFavoriteNoteDrafts((prev) => ({ ...prev, [item.poemId]: savedNote }));
 setFavoriteNoteMessages((prev) => {
 if (!prev[item.poemId]) {
 return prev;
 }
 const copy = { ...prev };
 delete copy[item.poemId];
 return copy;
 });
 }}
 disabled={noteSaving || !noteChanged}
 className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-60"
 >
 撤销修改
 </button>
 </div>
 </div>

 <div className="mt-4 flex flex-wrap gap-2">
 <Link to={`/learn/${item.poemId}`} className="btn-secondary-compact">
 进入学习
 </Link>
 <Link
 to={`/practice?topic=${encodeURIComponent(item.poem?.title ||"")}&count=5&difficulty=medium&auto=1`}
 className="btn-secondary-compact text-ink-700 hover:bg-ink-50"
 >
 基于此诗练习
 </Link>
 <button
 type="button"
 onClick={() => void unfavoritePoem(item.poemId)}
 disabled={unfavoriteLoadingId === item.poemId}
 className="rounded-lg shadow-[inset_0_0_0_1px_rgba(239,68,68,0.24)] px-3 py-1.5 text-xs text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
 >
 {unfavoriteLoadingId === item.poemId ?"处理中..." :"取消收藏"}
 </button>
 </div>
 </article>
 </div>
 );
 }}
 />
 ) : null}
 </section>
 );
}

