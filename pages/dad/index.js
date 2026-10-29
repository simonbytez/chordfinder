// Sub-links of /dad. They point at static pages in public/dad (routed by the
// rewrites in next.config.js), so they use plain <a> tags rather than next/link.
const links = [
  ["tim keller", "/dad/tim-keller"],
];

export default function Dad() {
  return <h1 className="title">
    {links.map(([label, href]) => <span key={href}>
      <a href={href}>{label}</a>
      <br/>
    </span>)}
  </h1>
}
