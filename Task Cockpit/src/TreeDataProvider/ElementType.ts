

enum ElementType {

    PinsSection   /**/ = '\x00\x00:Pinned',
    ScopeSection  /**/ = '\x00\x00:Scope',
    // -----
    EmptyNode         /**/ = '\x00\x00:SpecialEmpty',
    RunnableNode      /**/ = '\x00\x00:Runnable',
    IntermediateNode  /**/ = '\x00\x00:Intermediate'
}

export default ElementType;
