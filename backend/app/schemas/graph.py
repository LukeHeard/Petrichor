from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class GraphNode(BaseModel):
    id: str
    label: str
    type: str  # 'Work', 'Author', 'Tag'
    val: float # Size of node
    color: str
    properties: Dict[str, Any] = {}

class GraphLink(BaseModel):
    source: str
    target: str
    type: str  # 'WROTE', 'HAS_TAG'

class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    links: List[GraphLink]
