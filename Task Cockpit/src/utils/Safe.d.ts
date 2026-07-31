
type Methods =
    | 'dispose'

    ;

type Safe<T> =
    Readonly<Omit<T, Methods & keyof T>>;


export default Safe;
