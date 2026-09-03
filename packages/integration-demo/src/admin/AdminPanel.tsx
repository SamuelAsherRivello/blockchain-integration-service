import userStoriesUrl from '../../../../documentation/User Story Diagrams.md?url';

const stories = [{ id: 'A1', category: 'Account', label: 'Account Button' }, { id: 'A2', category: 'Account', label: 'Create Account' }, { id: 'A6', category: 'Account', label: 'Log Out' }] as const;
export function AdminPanel({ selected, accountOpen, canReset, error, onSelect, onReset }: {
  selected: string | null; accountOpen: boolean; canReset: boolean; error?: string; onSelect(id: string): void; onReset(): void;
}) {
  return <aside className="admin-panel" aria-label="Admin UI">
    <h1 className="panel-title">Admin</h1>
    <section aria-labelledby="documentation-title">
      <h2 id="documentation-title" className="admin-section-title">User Stories</h2>
      <a className="documentation-link" href={userStoriesUrl} target="_blank" rel="noopener noreferrer">Documentation ↗</a>
    </section>
    <nav aria-label="User stories">
      {[...new Set(stories.map(story => story.category))].map(category => <section key={category}>
        <h3 className="category-title">{category}</h3>
        {stories.filter(story => story.category === category).map(story =>
          <button key={story.id} className="story-button" aria-pressed={selected === story.id} disabled={accountOpen} onClick={()=>onSelect(story.id)}>
            <span>{story.id}</span>{story.label}<span className="story-arrow" aria-hidden="true">↗</span>
          </button>)}
      </section>)}
    </nav>
    {error && <p role="alert">{error}</p>}
    <button className="reset-button" disabled={!canReset} onClick={onReset}>Reset Client</button>
  </aside>;
}
