import { Link } from "react-router-dom";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps): JSX.Element {
  return (
    <section className="page-shell">
      <article className="surface-card card-roomy flow-md mx-auto w-full max-w-[640px]">
        <div>
          <p className="section-kicker">页面提示</p>
          <h1 className="mt-2 font-display text-3xl text-ink-700">{title}</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/" className="btn-primary w-full sm:w-auto">
            返回首页
          </Link>
          <Link to="/explore" className="btn-secondary w-full sm:w-auto">
            去探索页
          </Link>
        </div>
      </article>
    </section>
  );
}
