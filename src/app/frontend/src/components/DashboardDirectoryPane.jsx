import React, { useState, useRef, useEffect } from 'react';

export function DashboardDirectoryPane({
  dashboard,
  projects,
  onSave,
  onClone,
  onDelete,
  onPublish,
  onRename,
  onBack,
  hasUnsavedChanges,
}) {
  const [showPublishPicker, setShowPublishPicker] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const nameInputRef = useRef(null);

  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [cloneProject, setCloneProject] = useState('General');

  const isPublished = dashboard?.project && dashboard.project !== 'General';
  const isUntitled = dashboard?.name === 'Untitled Dashboard';

  const startRename = () => {
    setNameValue(dashboard?.name || '');
    setEditingName(true);
  };

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  const commitRename = () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== dashboard?.name) {
      onRename(trimmed);
    }
    setEditingName(false);
  };

  const handlePublish = (projectName) => {
    if (projectName && projectName.trim()) {
      if (isUntitled) {
        alert('Please name your dashboard before publishing. Click the name to rename it.');
        return;
      }
      onPublish(projectName.trim());
      setShowPublishPicker(false);
      setNewProjectName('');
    }
  };

  const handleUnpublish = () => {
    onPublish('General');
  };

  const openCloneModal = () => {
    setCloneName(`${dashboard?.name || 'Dashboard'} (Copy)`);
    setCloneProject('General');
    setShowCloneModal(true);
  };

  const submitClone = () => {
    if (!cloneName.trim()) return;
    onClone(cloneName.trim(), cloneProject);
    setShowCloneModal(false);
  };

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 bg-charcoal-600 border-b border-charcoal-200 rounded-t-lg">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-gray-200 transition-colors text-sm flex items-center gap-1 shrink-0"
          >
            ← Directory
          </button>
          <span className="text-charcoal-200">|</span>
          <div className="flex items-center gap-1.5 min-w-0 text-sm">
            <span className="text-gray-400">{dashboard?.project || 'General'}</span>
            <span className="text-charcoal-200">/</span>
            {editingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setEditingName(false);
                }}
                className="bg-charcoal-700 border border-purple-500 rounded px-2 py-0.5 text-gray-100 font-semibold text-sm focus:outline-none w-56"
              />
            ) : (
              <button
                onClick={startRename}
                className={`font-semibold truncate hover:text-purple-300 transition-colors ${
                  isUntitled ? 'text-yellow-400 italic' : 'text-gray-100'
                }`}
                title="Click to rename"
              >
                {dashboard?.name || 'Untitled'}
              </button>
            )}
            {hasUnsavedChanges && (
              <span className="text-yellow-400 text-xs ml-1">(unsaved)</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onSave}
            className="px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-500 transition-colors font-medium"
          >
            Save
          </button>
          <button
            onClick={openCloneModal}
            className="px-3 py-1.5 text-sm rounded-lg bg-charcoal-400 text-gray-200 border border-charcoal-200 hover:bg-charcoal-300 transition-colors"
          >
            Clone
          </button>

          {isPublished ? (
            <button
              onClick={handleUnpublish}
              className="px-3 py-1.5 text-sm rounded-lg bg-yellow-600/30 text-yellow-300 border border-yellow-600/50 hover:bg-yellow-600/50 transition-colors"
            >
              Unpublish
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowPublishPicker(!showPublishPicker)}
                className="px-3 py-1.5 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition-colors font-medium"
              >
                Publish
              </button>
              {showPublishPicker && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-charcoal-500 border border-charcoal-200 rounded-lg shadow-xl p-3 w-64">
                  <p className="text-xs text-gray-400 mb-2">Choose or create a project:</p>
                  {projects.length > 0 && (
                    <div className="mb-2 max-h-32 overflow-y-auto">
                      {projects.map(p => (
                        <button
                          key={p}
                          onClick={() => handlePublish(p)}
                          className="w-full text-left px-2 py-1.5 text-sm text-gray-200 hover:bg-charcoal-400 rounded transition-colors"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="New project name..."
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handlePublish(newProjectName)}
                      className="flex-1 px-2 py-1.5 text-sm bg-charcoal-700 border border-charcoal-300 rounded text-gray-200 focus:outline-none focus:border-purple-500"
                      autoFocus
                    />
                    <button
                      onClick={() => handlePublish(newProjectName)}
                      disabled={!newProjectName.trim()}
                      className="px-2 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Go
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={onDelete}
            className="px-3 py-1.5 text-sm rounded-lg bg-red-600/30 text-red-300 border border-red-600/50 hover:bg-red-600/50 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Clone Modal */}
      {showCloneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCloneModal(false)} />
          <div className="relative bg-charcoal-600 border border-charcoal-200 rounded-xl shadow-2xl w-[420px] p-5">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Clone Dashboard</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitClone()}
                  className="w-full px-3 py-2 bg-charcoal-700 border border-charcoal-300 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-purple-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Project</label>
                <select
                  value={cloneProject}
                  onChange={(e) => setCloneProject(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-700 border border-charcoal-300 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
                >
                  <option value="General">General (private)</option>
                  {projects.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowCloneModal(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={submitClone}
                disabled={!cloneName.trim()}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Clone
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
