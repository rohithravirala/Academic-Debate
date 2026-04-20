import { useEffect, useMemo, useState } from 'react';
import TopNav from '../components/TopNav';
import api from '../services/api';
import UserAvatar from '../components/UserAvatar';

const composeDisplayName = (user) => {
  const parts = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ').trim();
  return parts || user.name || 'User';
};

function Leaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLeaderIndex, setSelectedLeaderIndex] = useState(null);

  const hasPreviewImage = (leader) => Boolean(leader?.profileImage || leader?.avatarUrl);

  const selectedLeader = useMemo(() => {
    if (selectedLeaderIndex === null) return null;
    return leaders[selectedLeaderIndex] || null;
  }, [leaders, selectedLeaderIndex]);

  const selectedImage = selectedLeader?.profileImage || selectedLeader?.avatarUrl || '';

  const closePreview = () => {
    setSelectedLeaderIndex(null);
  };

  const openPreview = (index) => {
    if (!hasPreviewImage(leaders[index])) return;
    setSelectedLeaderIndex(index);
  };

  const findNextPreviewIndex = (startIndex, step) => {
    if (!leaders.length) return null;
    let index = startIndex;

    for (let count = 0; count < leaders.length; count += 1) {
      index = (index + step + leaders.length) % leaders.length;
      if (hasPreviewImage(leaders[index])) {
        return index;
      }
    }

    return startIndex;
  };

  const goToNextPreview = () => {
    if (selectedLeaderIndex === null) return;
    const nextIndex = findNextPreviewIndex(selectedLeaderIndex, 1);
    if (nextIndex !== null) setSelectedLeaderIndex(nextIndex);
  };

  const goToPreviousPreview = () => {
    if (selectedLeaderIndex === null) return;
    const previousIndex = findNextPreviewIndex(selectedLeaderIndex, -1);
    if (previousIndex !== null) setSelectedLeaderIndex(previousIndex);
  };

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        setError('');
        const params = { all: true };
        if (search.trim()) {
          params.search = search.trim();
        }
        const { data } = await api.get('/api/leaderboard', { params });
        setLeaders(data);
      } catch (apiError) {
        setError(apiError.response?.data?.message || 'Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [search]);

  useEffect(() => {
    if (selectedLeaderIndex === null) return undefined;

    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        closePreview();
      }
      if (event.key === 'ArrowRight') {
        goToNextPreview();
      }
      if (event.key === 'ArrowLeft') {
        goToPreviousPreview();
      }
    };

    window.addEventListener('keydown', handleEsc);

    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [selectedLeaderIndex, leaders]);

  useEffect(() => {
    if (selectedLeaderIndex === null) return;

    if (!leaders[selectedLeaderIndex] || !hasPreviewImage(leaders[selectedLeaderIndex])) {
      closePreview();
    }
  }, [leaders, selectedLeaderIndex]);

  return (
    <div className="leaderboard-page-modern">
      <TopNav />
      <div className="leaderboard-shell leaderboard-wrapper">
        <section className="leaderboard-card-modern leaderboard-card">
          <div className="leaderboard-header-modern">
            <div>
              <h1 className="leaderboard-title-modern">Leaderboard</h1>
              <p className="leaderboard-subtitle-modern">Highest scoring debaters in the community</p>
            </div>
            <div className="leaderboard-search-wrap">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name..."
                className="leaderboard-search-input"
                aria-label="Search users by name"
              />
            </div>
          </div>

          {loading && <p className="subtle">Loading leaderboard...</p>}
          {error && <p className="error-text">{error}</p>}

          {!loading && !error && leaders.length === 0 && (
            <p className="leaderboard-empty-state">No users found</p>
          )}

          {!loading && !error && leaders.length > 0 && (
            <div className="leaderboard-rows-modern leaderboard-container">
              {leaders.map((leader, index) => {
                const displayName = composeDisplayName(leader);
                const displayRank = Number.isInteger(leader?.rank) ? leader.rank : index + 1;
                const isTopRank = displayRank === 1;
                const isTopThree = displayRank <= 3;

                return (
                  <article
                    key={leader._id || `${displayName}-${index}`}
                    className={`leaderboard-row-modern ${isTopRank ? 'leaderboard-row-top' : ''} ${isTopThree ? 'leaderboard-row-top-three' : ''}`}
                  >
                    <div className={`leaderboard-rank-pill ${isTopRank ? 'rank-one' : ''}`}>#{displayRank}</div>

                    <button
                      type="button"
                      className={`leaderboard-avatar-trigger ${hasPreviewImage(leader) ? 'previewable' : 'non-previewable'}`}
                      onClick={() => openPreview(index)}
                      title={hasPreviewImage(leader) ? `Preview ${displayName}` : `${displayName} has no image`}
                      disabled={!hasPreviewImage(leader)}
                    >
                      <UserAvatar
                        src={leader.profileImage || leader.avatarUrl}
                        name={displayName}
                        size="md"
                        className="leaderboard-avatar-modern"
                      />
                    </button>

                    <div className="leaderboard-user-meta">
                      <h3>{displayName}</h3>
                      <p>{leader.role || 'Participant'}</p>
                    </div>

                    <div className="leaderboard-points-modern">
                      <span className="points-value">{leader.points ?? 0}</span>
                      <span className="points-label">Points</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {selectedLeader && selectedImage && (
        <div
          className="leaderboard-lightbox-overlay"
          onClick={closePreview}
          role="dialog"
          aria-modal="true"
          aria-label="Avatar preview"
        >
          <div
            className="leaderboard-lightbox-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="leaderboard-lightbox-close"
              onClick={closePreview}
              aria-label="Close avatar preview"
            >
              ✕
            </button>

            <button
              type="button"
              className="leaderboard-lightbox-arrow left"
              onClick={goToPreviousPreview}
              aria-label="Previous avatar"
            >
              ‹
            </button>

            <img
              src={selectedImage}
              alt={composeDisplayName(selectedLeader)}
              className="leaderboard-lightbox-image"
            />

            <button
              type="button"
              className="leaderboard-lightbox-arrow right"
              onClick={goToNextPreview}
              aria-label="Next avatar"
            >
              ›
            </button>

            <div className="leaderboard-lightbox-meta">
              <strong>{composeDisplayName(selectedLeader)}</strong>
              <span>
                Rank #{Number.isInteger(selectedLeader?.rank) ? selectedLeader.rank : selectedLeaderIndex + 1} • {selectedLeader.points ?? 0} points
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Leaderboard;
