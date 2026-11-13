import styles from './GroupAudienceSelector.module.css';

export interface GroupOption {
  id: string;
  name: string;
  groupType: 'static' | 'dynamic';
}

interface GroupAudienceSelectorProps {
  groups: GroupOption[];
  selectedGroupIds: string[];
  onChange: (groupIds: string[]) => void;
  description?: string;
  emptyMessage?: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

const MAX_SELECTED_GROUPS = 100;

export default function GroupAudienceSelector({
  groups,
  selectedGroupIds,
  onChange,
  description = 'Select one or more groups to target their combined audience. Leave all unchecked to include all eligible patients.',
  emptyMessage = 'No active groups are available. All eligible patients will be included.',
  loading = false,
  error = '',
  onRetry,
}: GroupAudienceSelectorProps) {
  const availableIds = new Set(groups.map((group) => group.id));
  const unavailableIds = selectedGroupIds.filter((id) => !availableIds.has(id));

  function toggleGroup(groupId: string, selected: boolean) {
    if (selected) {
      if (selectedGroupIds.length >= MAX_SELECTED_GROUPS) return;
      onChange([...selectedGroupIds, groupId]);
    } else {
      onChange(selectedGroupIds.filter((id) => id !== groupId));
    }
  }

  return (
    <fieldset className={styles.groupSelector} disabled={loading}>
      <legend>Patient groups</legend>
      <p className={styles.description}>{description}</p>
      {loading ? (
        <p className={styles.status}>Loading active groups…</p>
      ) : error ? (
        <div className={styles.error} role="alert">
          <span>{error}</span>
          {onRetry && (
            <button type="button" className={styles.retryButton} onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      ) : (
        <>
          {unavailableIds.length > 0 && (
            <div className={styles.error} role="alert">
              <span>
                {unavailableIds.length} selected {unavailableIds.length === 1 ? 'group is' : 'groups are'} archived or unavailable.
                Remove {unavailableIds.length === 1 ? 'it' : 'them'} before saving.
              </span>
              <button
                type="button"
                className={styles.retryButton}
                onClick={() => onChange(selectedGroupIds.filter((id) => availableIds.has(id)))}
              >
                Remove unavailable groups
              </button>
            </div>
          )}
          {groups.length === 0 ? (
            <p className={styles.status}>{emptyMessage}</p>
          ) : (
            <div className={styles.options}>
              {groups.map((group) => {
                const checked = selectedGroupIds.includes(group.id);
                return (
                  <label className={styles.option} key={group.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && selectedGroupIds.length >= MAX_SELECTED_GROUPS}
                      onChange={(event) => toggleGroup(group.id, event.target.checked)}
                    />
                    <span>{group.name}</span>
                    <small>{group.groupType === 'dynamic' ? 'Dynamic' : 'Static'}</small>
                  </label>
                );
              })}
            </div>
          )}
          {selectedGroupIds.length >= MAX_SELECTED_GROUPS && (
            <p className={styles.status}>You can select up to {MAX_SELECTED_GROUPS} groups.</p>
          )}
        </>
      )}
    </fieldset>
  );
}
