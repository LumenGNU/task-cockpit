
type Methods =
    | 'dispose'

    ;

type LifecycleOmitted<T> =
    Readonly<Omit<T, Methods & keyof T>>;


export default LifecycleOmitted;
