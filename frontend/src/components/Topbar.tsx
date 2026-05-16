import {Moon,Sun} from 'lucide-react';
import type {Theme} from '../types';

type Props={
  theme:Theme;
  judgeCount:number;
  solvedCount:number;
  totalCount:number;
  progress:number;
  onToggleTheme:()=>void;
}

function Topbar({theme,judgeCount,solvedCount,totalCount,progress,onToggleTheme}:Props){
  return <header className="topbar">
    <div className="brand-lockup">
      <div className="go-logo-wrap"><img src="/go-logo.svg" alt="Go" /></div>
      <div><h1>PracDaGo</h1><p>book-first Go practice</p></div>
    </div>
    <div className="topbar-actions">
      <div className="progress-summary">
        <span>{judgeCount} judgeable</span>
        <span>{solvedCount}/{totalCount} solved</span>
        <div className="progress-track"><div className="progressbar" style={{width:progress+'%'}}/></div>
        <span>{progress}%</span>
      </div>
      <button
        type="button"
        className="theme-toggle"
        onClick={onToggleTheme}
        aria-label={`Switch to ${theme==='dark'?'light':'dark'} mode`}
        title={`Switch to ${theme==='dark'?'light':'dark'} mode`}
      >
        {theme==='dark'?<Sun size={16}/>:<Moon size={16}/>}
        <span>{theme==='dark'?'Light':'Dark'}</span>
      </button>
    </div>
  </header>;
}

export default Topbar;
