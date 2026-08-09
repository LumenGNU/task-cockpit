
import EmptyElement from './EmptyElement';
import IntermediateElement from './IntermediateElement';
import RunnableElement from './RunnableElement';
import TopElement from './TopElement';

type Element =
    | EmptyElement
    | IntermediateElement
    | RunnableElement
    | TopElement;

export default Element;
