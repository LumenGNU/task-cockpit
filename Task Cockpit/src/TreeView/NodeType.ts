

enum NodeType {

    PinsSection   /**/ = '\x00\x00:Pinned',
    SubSection    /**/ = '\x00\x00:SubSection',
    ScopeSection  /**/ = '\x00\x00:Scope',
    // -----
    EmptyNode         /**/ = '\x00\x00:SpecialEmpty',
    StaleNode         /**/ = '\x00\x00:SpecialStale',
    RunnableNode      /**/ = '\x00\x00:Runnable',
    IntermediateNode  /**/ = '\x00\x00:Intermediate'
}

export default NodeType;
