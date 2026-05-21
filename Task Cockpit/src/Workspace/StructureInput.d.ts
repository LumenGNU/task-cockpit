/** @file Workspace/StructureInput.ts */
/** @module StructureInput */


import type ScopeKey from '../type.d/ScopeKey';
import type Definition from './Definition';
import type Scope from './Scope';
import type ScopedConfig from './ScopedConfig';


/** Снимок данных конфигураций и задач для физической структуры
 * рабочей области (открытых папок). По одной записи на каждый {@linkcode Scope} из текущего состояния.
 *
 * (Не включает в себя мета-секции дерева (историю, фавориты...).)
 *
 * Создаётся непосредственно перед построением дерева и не кэшируется
 * в этом модуле — решение о повторном использовании принимает вызывающая сторона.
 *
 * Ключи упорядочены в соответствии с порядком `scopes` —
 * порядок обхода дерева стабилен. */
type StructureInput = Record<ScopeKey, StructureInput.ScopeInput>;


declare namespace StructureInput {

    /** Входные данные для одного {@link Scope}:
     * конфигурация и определения задач, собранные
     * на момент запроса построения дерева. */
    export interface ScopeInput {
        scope: Scope;
        /** {@link ScopedConfig | Конфигурация области}. */
        config: ScopedConfig;
        /** @see {@link Definition.ScopeMap} */
        definitions: Definition.ScopeMap;
    }

}


export default StructureInput;
