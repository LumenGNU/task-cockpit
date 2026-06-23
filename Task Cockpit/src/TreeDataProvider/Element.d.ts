import EmptyElement from './Node/EmptyElement';
import IntermediateElement from './Node/IntermediateElement';
import PinsElement from './Section/PinsElement';
import RunnableElement from './Node/RunnableElement';
import ScopeElement from './Section/ScopeElement';

type Element =
    | ScopeElement
    | EmptyElement
    | IntermediateElement
    | RunnableElement
    | PinsElement
    ;

export default Element;
