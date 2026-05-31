

enum NodeType {

    ContentNode   /**/ = '\x00\x00:ContentNode',
    PinsSection   /**/ = '\x00\x00:Pinned',
    SubSection    /**/ = '\x00\x00:SubSection',
    ScopeSection  /**/ = '\x00\x00:Scope',
    EmptyNode     /**/ = '\x00\x00:SpecialEmpty',
    StaleNode     /**/ = '\x00\x00:SpecialStale'
}

export default NodeType;
