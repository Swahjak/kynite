# Reward Store Feature Specification

## Overview

The Reward Store is a gamification feature that motivates children to complete tasks by allowing them to spend earned stars on rewards. Children can browse and redeem rewards from a family-managed catalog; parents manage the reward inventory through a separate interface. Stars are earned through reward charts, chores, timers, and bonus awards.

## Documents

| Document                      | Description                                       |
| ----------------------------- | ------------------------------------------------- |
| [Data Model](./data-model.md) | Database schema, star transactions, API endpoints |
| [UI Specification](./ui.md)   | Components, redemption flow, interaction modes    |

## Design Reference

Visual mockups available in `docs/design/reward-store/`:

- `reward-store-design-*.png` - Store layout mockups

> **Note:** Mockups are reference only. Implement using project brand guidelines.

## Key Features

### Star System

- View current star balance (cached for fast reads)
- Weekly earnings delta display
- Transaction history with filtering by type
- Real-time balance updates via Pusher

### Reward Catalog

- Browse available rewards with emoji icons
- Rewards sorted by star cost (ascending)
- Active/inactive reward filtering
- Limit types: none, daily, weekly, monthly, once

### Redemption Flow

- Instant redemption with optional confirmation
- Limit enforcement with "next available" dates
- Insufficient stars messaging with gap amount
- Redemption history per member

### Primary Goals

- Each child can set one reward as their primary goal
- Goal progress tracking (current balance vs. cost)
- Visual indicator on goal reward card

### Management (Managers Only)

- Create, update, delete rewards
- Award bonus stars to any member
- Set active/inactive status
- Configure redemption limits

## Key Constraints

- Redemption limits are enforced per member, per period (rolling)
- Stars cannot go negative (balance check before redemption)
- Deleted rewards cascade to redemptions (historical records removed)
- Only managers can create/modify rewards or award bonus stars
- Devices can redeem on behalf of children (wall-hub support)
