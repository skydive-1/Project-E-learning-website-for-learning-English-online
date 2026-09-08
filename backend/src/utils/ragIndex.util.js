'use strict';

function getActiveRagVersion() {
  return String(process.env.ACTIVE_RAG_VERSION || 'v2').toLowerCase();
}

function getRagNamespace(version = getActiveRagVersion()) {
  return version === 'v2'
    ? (process.env.PINECONE_NAMESPACE_V2 || process.env.PINECONE_NAMESPACE || 'rag-v2')
    : (process.env.PINECONE_NAMESPACE_V1 || '');
}

function getRagIndex(index, version = getActiveRagVersion()) {
  const namespace = getRagNamespace(version);
  return index && namespace && typeof index.namespace === 'function'
    ? index.namespace(namespace)
    : index;
}

module.exports = { getActiveRagVersion, getRagNamespace, getRagIndex };
