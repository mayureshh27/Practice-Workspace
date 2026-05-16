import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Props={
  text:string;
  className?:string;
}

function MarkdownView({text,className=''}:Props){
  return <div className={`markdown-body ${className}`.trim()}><ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown></div>;
}

export default MarkdownView;
