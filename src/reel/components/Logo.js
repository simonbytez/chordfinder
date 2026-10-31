import s from '../../../styles/Reel.module.css';

export default function Logo({ className }) {
  return <span className={`${s.logo} ${className || ''}`}>Reel</span>;
}
