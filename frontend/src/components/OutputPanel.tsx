import type {OutputComparison} from '../types';
import MarkdownView from './MarkdownView';

type Props={
  verdict:string;
  output:string;
  emptyMessage:string;
  comparison:OutputComparison|null;
}

function OutputPanel({verdict,output,emptyMessage,comparison}:Props){
  return <div className="output-panel markdown-body scrollbar">
    <div className={`verdict ${verdict==='Accepted'?'ok':verdict==='Error'?'bad':''}`}>{verdict||'Output'}</div>
    {comparison&&<div className="output-comparison">
      <div className="comparison-head">
        <b>{comparison.title}</b>
        <span className={`compare-status ${comparison.status}`}>{comparison.status==='match'?'Matches':'Diff found'}</span>
      </div>
      <div className="compare-grid">
        <div className="compare-cell">
          <span>Expected</span>
          <pre>{comparison.expected}</pre>
        </div>
        <div className="compare-cell">
          <span>Actual</span>
          <pre>{comparison.actual}</pre>
        </div>
      </div>
      {comparison.diff&&<div className="diff-row">
        <b>First different line {comparison.diff.line}</b>
        <span>Expected: {comparison.diff.expected}</span>
        <span>Actual: {comparison.diff.actual}</span>
      </div>}
    </div>}
    <MarkdownView text={output||emptyMessage} className="output-markdown"/>
  </div>;
}

export default OutputPanel;
