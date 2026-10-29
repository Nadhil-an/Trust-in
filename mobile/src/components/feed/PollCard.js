// components/feed/PollCard.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pollsApi } from '../../api';
import Toast from 'react-native-toast-message';

export default function PollCard({
  poll,
  isAuthenticated,
  navigation,
  onVoteSuccess,
}) {
  const [localPoll, setLocalPoll] = useState(poll);
  const [submittingOptionId, setSubmittingOptionId] = useState(null);

  // Sync whenever parent provides fresh poll data (e.g., from real-time websocket)
  useEffect(() => {
    if (poll) {
      setLocalPoll(poll);
    }
  }, [poll]);

  if (!localPoll) return null;

  const currentPoll = localPoll;
  const isClosed = currentPoll.status === 'CLOSED' || (currentPoll.end_time && new Date() > new Date(currentPoll.end_time));
  const totalVotes = currentPoll.total_votes || 0;
  const myVotedOptionId = currentPoll.my_voted_option_id;

  const formatDeadline = (dateStr) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return dateStr;
    }
  };

  const handleOptionPress = async (option) => {
    if (isClosed) {
      Toast.show({
        type: 'info',
        text1: 'Voting Concluded',
        text2: 'This poll has ended and is no longer accepting votes.',
      });
      return;
    }

    if (!isAuthenticated) {
      Toast.show({
        type: 'info',
        text1: 'Sign in to Vote',
        text2: 'Please log in with your member account to vote.',
      });
      setTimeout(() => {
        navigation.navigate('Auth');
      }, 400);
      return;
    }

    const previousVotedId = myVotedOptionId;
    const isSameOption = String(previousVotedId) === String(option.id);

    // Optimistic local state update (0ms instant UI update)
    setLocalPoll((prev) => {
      const prevOptions = prev.options || [];
      let newTotal = prev.total_votes || 0;

      if (!previousVotedId) {
        newTotal += 1;
      }

      const updatedOptions = prevOptions.map((opt) => {
        let count = opt.votes_count || 0;
        if (String(opt.id) === String(option.id)) {
          if (!isSameOption) count += 1;
        } else if (String(opt.id) === String(previousVotedId)) {
          count = Math.max(0, count - 1);
        }
        return {
          ...opt,
          votes_count: count,
          percentage: newTotal > 0 ? Math.round((count / newTotal) * 100) : 0,
        };
      });

      return {
        ...prev,
        has_voted: true,
        my_voted_option_id: option.id,
        total_votes: newTotal,
        options: updatedOptions,
      };
    });

    setSubmittingOptionId(option.id);
    try {
      const res = await pollsApi.vote(currentPoll.id, option.id);
      const pollData = res.data?.poll || (res.data?.id ? res.data : null);
      if (pollData) {
        setLocalPoll(pollData);
      }
      if (onVoteSuccess) {
        onVoteSuccess();
      }
      if (!isSameOption && previousVotedId) {
        Toast.show({
          type: 'success',
          text1: 'Vote Changed',
          text2: `Your vote was changed to "${option.option_text}".`,
        });
      }
    } catch (err) {
      const errMsg = err?.response?.data?.error || 'Failed to submit vote. Reverting.';
      Toast.show({
        type: 'error',
        text1: 'Voting Notice',
        text2: errMsg,
      });
      // Revert to original prop poll on failure
      setLocalPoll(poll);
    } finally {
      setSubmittingOptionId(null);
    }
  };

  return (
    <View style={styles.cardContainer}>
      {/* Top Header Badge Row */}
      <View style={styles.badgeRow}>
        <View style={styles.leftBadges}>
          {isClosed ? (
            <View style={[styles.statusBadge, styles.badgeClosed]}>
              <Ionicons name="lock-closed" size={11} color="#64748b" style={{ marginRight: 4 }} />
              <Text style={styles.badgeClosedText}>VOTING CLOSED</Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, styles.badgeActive]}>
              <View style={styles.liveDot} />
              <Text style={styles.badgeActiveText}>LIVE VOTING</Text>
            </View>
          )}
        </View>

        <View style={styles.votesCounter}>
          <Ionicons name="people-outline" size={13} color="#64748b" style={{ marginRight: 4 }} />
          <Text style={styles.votesCounterText}>
            {totalVotes} {totalVotes === 1 ? 'Vote' : 'Votes'}
          </Text>
        </View>
      </View>

      {/* Title & Description */}
      <Text style={styles.pollTitle}>{currentPoll.title}</Text>
      {Boolean(currentPoll.description) && (
        <Text style={styles.pollDescription}>{currentPoll.description}</Text>
      )}

      {/* Interactive Options List — Every option displays percentage, count & allows re-clicking */}
      <View style={styles.optionsContainer}>
        {(currentPoll.options || []).map((opt) => {
          const isSelected = String(myVotedOptionId) === String(opt.id);
          const isBusy = submittingOptionId === opt.id;
          const pct = typeof opt.percentage === 'number'
            ? opt.percentage
            : (totalVotes > 0 ? Math.round(((opt.votes_count || 0) / totalVotes) * 100) : 0);
          const count = opt.votes_count || 0;

          return (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.optionRow,
                isSelected && styles.optionRowSelected,
                isClosed && styles.optionRowDisabled,
              ]}
              activeOpacity={0.8}
              disabled={isClosed}
              onPress={() => handleOptionPress(opt)}
            >
              {/* Proportional Progress Fill */}
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(100, Math.max(0, pct))}%`,
                    backgroundColor: isSelected ? '#dbeafe' : '#f1f5f9',
                  },
                ]}
              />

              {/* Option Content Overlay */}
              <View style={styles.optionContent}>
                {/* Left: Radio/Check Indicator + Text + Badge */}
                <View style={styles.optionLeftGroup}>
                  <View
                    style={[
                      styles.checkCircle,
                      isSelected && styles.checkCircleSelected,
                    ]}
                  >
                    {isBusy ? (
                      <ActivityIndicator size={10} color="#0284c7" />
                    ) : isSelected ? (
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    ) : null}
                  </View>

                  <View style={styles.textWithBadgeRow}>
                    <Text
                      style={[
                        styles.optionLabel,
                        isSelected && styles.optionLabelSelected,
                      ]}
                      numberOfLines={2}
                    >
                      {opt.option_text}
                    </Text>

                    {isSelected && (
                      <View style={styles.yourVoteBadge}>
                        <Text style={styles.yourVoteBadgeText}>Your Vote</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Right: Percent & Vote Count */}
                <View style={styles.optionStatsGroup}>
                  <Text
                    style={[
                      styles.statPercent,
                      isSelected && styles.statPercentSelected,
                    ]}
                  >
                    {pct}%
                  </Text>
                  <Text style={styles.statVotesCount}>
                    {count} {count === 1 ? 'vote' : 'votes'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Helpful Hint on Tap */}
      <View style={styles.helperRow}>
        <Ionicons name="information-circle-outline" size={13} color="#94a3b8" />
        <Text style={styles.helperText}>
          {myVotedOptionId
            ? 'Tap any other option anytime to change your vote.'
            : 'Tap any option to cast your vote.'}
        </Text>
      </View>

      {/* Deadline Footer */}
      {Boolean(currentPoll.end_time) && (
        <View style={styles.deadlineRow}>
          <Ionicons name="time-outline" size={13} color="#94a3b8" style={{ marginRight: 4 }} />
          <Text style={styles.deadlineText}>
            {isClosed ? 'Concluded on: ' : 'Deadline: '}
            {formatDeadline(currentPoll.end_time)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  leftBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeActive: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 5,
  },
  badgeActiveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    letterSpacing: 0.4,
  },
  badgeClosed: {
    backgroundColor: '#f1f5f9',
  },
  badgeClosedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.3,
  },
  votesCounter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  votesCounterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  pollTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 22,
    marginBottom: 4,
  },
  pollDescription: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 14,
  },
  optionsContainer: {
    gap: 10,
    marginVertical: 4,
  },
  optionRow: {
    position: 'relative',
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  optionRowSelected: {
    borderColor: '#0284c7',
    borderWidth: 2,
    backgroundColor: '#f8fafc',
  },
  optionRowDisabled: {
    opacity: 0.75,
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 10,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  optionLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.8,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#ffffff',
  },
  checkCircleSelected: {
    borderColor: '#0284c7',
    backgroundColor: '#0284c7',
  },
  textWithBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  optionLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1e293b',
    flexShrink: 1,
  },
  optionLabelSelected: {
    color: '#0284c7',
    fontWeight: '700',
  },
  yourVoteBadge: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  yourVoteBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  optionStatsGroup: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    minWidth: 55,
  },
  statPercent: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  statPercentSelected: {
    color: '#0284c7',
  },
  statVotesCount: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1,
  },
  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  helperText: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  deadlineText: {
    fontSize: 11,
    color: '#94a3b8',
  },
});
