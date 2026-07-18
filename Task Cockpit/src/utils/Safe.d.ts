
type Methods =
    | 'dispose'
    ;

type Safe<T> =
    Omit<T, Methods & keyof T>;


export default Safe;
