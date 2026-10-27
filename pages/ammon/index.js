// Sub-links of /ammon. They point at static pages in public/ammon (routed by the
// rewrites in next.config.js), so they use plain <a> tags rather than next/link.
const links = [
  ["republic of rome", "/ammon/republic-of-rome"],
];

export default function Ammon() {
  return <h1 className="title">
    {links.map(([label, href]) => <span key={href}>
      <a href={href}>{label}</a>
      <br/>
    </span>)}
  </h1>
}
