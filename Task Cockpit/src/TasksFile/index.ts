/** @file TasksFile/index.ts */
/** @module TasksFile */

import DiagnosticsManager from "./DiagnosticsManager";
import dependencies from "./Checkers/Dependencies";
import duplicates from "./Checkers/Duplicates";
import openTask from "./OpenTask";


const Checkers = {
    duplicates,
    dependencies
};


export default {
    openTask,
    DiagnosticsManager,
    Checkers
};
