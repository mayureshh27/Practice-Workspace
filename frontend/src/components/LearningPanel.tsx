import {BookOpen,List} from 'lucide-react';
import {flowContent,flowTabs,splitLessonSections} from '../problemContent';
import type {FlowTab,Problem} from '../types';
import MarkdownView from './MarkdownView';

type Props={
  problem:Problem;
  tab:FlowTab;
  onTab:(tab:FlowTab)=>void;
}

function LearningPanel({problem,tab,onTab}:Props){
  const sections=splitLessonSections(flowContent(problem,tab));
  const idPrefix=`lesson-${problem.id}-${tab}`;

  function jumpTo(sectionId:string){
    if(typeof document==='undefined') return;
    document.getElementById(`${idPrefix}-${sectionId}`)?.scrollIntoView({block:'start',behavior:'smooth'});
  }

  return <section className="learning-panel">
    <div className="section-header">
      <div className="section-kicker"><BookOpen size={16}/> Exercise workspace</div>
      <h2>{problem.title}</h2>
      <div className="chip-row">
        <span className="chip">{problem.exerciseMode==='judge'?'Local judge':'Project-style'}</span>
        {problem.tags.slice(0,4).map(t=><span className="chip" key={t}>{t}</span>)}
      </div>
      <div className="tab-row">{flowTabs.map(t=><button key={t.id} type="button" className={tab===t.id?'active':''} onClick={()=>onTab(t.id)}>{t.label}</button>)}</div>
    </div>
    <div className="lesson-layout">
      <nav className="lesson-outline scrollbar" aria-label="Lesson outline">
        <div className="outline-title"><List size={15}/> Outline</div>
        {sections.map((section,index)=><button key={section.id} type="button" className="outline-link" onClick={()=>jumpTo(section.id)}>
          <span>{String(index+1).padStart(2,'0')}</span>
          {section.title}
        </button>)}
      </nav>
      <div className="lesson-sections content-scroll scrollbar">
        {sections.map((section,index)=><article className="lesson-block" id={`${idPrefix}-${section.id}`} key={section.id}>
          <div className="lesson-index">{String(index+1).padStart(2,'0')}</div>
          <h3>{section.title}</h3>
          <MarkdownView text={section.body||' '} className="lesson-markdown"/>
        </article>)}
      </div>
    </div>
  </section>;
}

export default LearningPanel;
