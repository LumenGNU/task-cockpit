import type Config from './Config';


interface Reader {
    readonly read: () => Config;
}


export default Reader;
