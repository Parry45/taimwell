export default function ShortcutGuide() {
  const origin = typeof location !== 'undefined' ? location.origin : 'https://your-app.vercel.app';
  return (
    <div className="col gap-12">
      <span className="heading">Capture from WhatsApp on iPhone 💬</span>
      <div className="card tight bg-lime-soft" style={{ boxShadow: 'none' }}>
        <span className="strong">Quickest: copy & paste</span>
        <span className="small">Long-press the message → Copy → open Taimwell → tap ＋ → “Paste message”. Taimwell reads who, what and when.</span>
      </div>
      <div className="col gap-8">
        <span className="strong">One-tap: “Send to Taimwell” Shortcut</span>
        <ol className="small" style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li>Open the <b>Shortcuts</b> app → <b>＋</b> → name it <b>Send to Taimwell</b>.</li>
          <li>Tap the ⓘ / settings icon → turn on <b>Show in Share Sheet</b> (accepts Text and URLs).</li>
          <li>Add action <b>URL Encode</b> → input: <i>Shortcut Input</i>.</li>
          <li>
            Add action <b>Text</b>: <code style={{ wordBreak: 'break-all' }}>{origin}/capture?source=whatsapp&amp;text=</code> then insert the <i>URL Encoded Text</i> variable at the end.
          </li>
          <li>Add action <b>Open URLs</b>.</li>
        </ol>
        <span className="small muted">
          In WhatsApp: long-press a message → Share (or Forward → Share) → <b>Send to Taimwell</b>. It opens in Safari, so sign in there once too; everything syncs to your home-screen app.
        </span>
      </div>
    </div>
  );
}
