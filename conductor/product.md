# Product Definition

## Vision

Weekly Eats is an all-in-one kitchen hub that centralizes recipes, meal plans, pantry tracking, and shopping lists for households and families.

## Problem Statement

Busy households struggle to coordinate weekly meals, keep track of pantry inventory, manage shared recipes, and create efficient shopping lists. Existing tools are fragmented - one app for recipes, another for shopping lists, spreadsheets for meal planning - leading to wasted food, duplicated effort, and mealtime stress.

## Target Users

- **Households and families** who collaborate on meal planning and grocery shopping
- Primary users share meal plans, recipes, and shopping lists across household members
- Users range from casual cooks to organized meal preppers

## Success Criteria

- Households can plan a full week of meals in minutes
- Shopping lists auto-generate from meal plans and can be cross-referenced against pantry staples
- Multiple household members can collaborate in real-time on shared lists
- Recipe library grows organically with personal and shared (global) recipes

## Core Features

1. **Recipe Management** - Create, edit, tag, and rate recipes with ingredient lists and instructions; support for personal and global recipes with sharing capabilities
2. **Meal Planning** - Weekly meal plans with configurable start days and meal types (breakfast, lunch, dinner, staples); drag-and-drop meal assignment with template support
3. **Shopping Lists** - Store-based shopping lists with real-time collaboration via Ably; auto-generation from meal plans; shared store access with invitations
4. **Pantry Tracking** - Maintain a list of items typically kept in the pantry so users can quickly cross-check shopping lists against what they usually have on hand; not a precise inventory system
5. **Food Item Database** - Centralized food items with units, categories, and emoji; shared across recipes, pantry, and shopping lists
6. **Household Collaboration** - Meal plan sharing with invitations, store sharing for shopping lists, recipe data sharing (tags, ratings), user approval workflow
7. **User Management** - NextAuth-based authentication with admin/approval roles; settings for recipe sharing and meal plan sharing preferences

## Non-Goals

- Native mobile apps (iOS/Android) - web-responsive approach serves both desktop and mobile
- Nutritional tracking or calorie counting
- Grocery delivery integration
- Social/public recipe sharing beyond household

## Constraints

- Self-hosted web application using Next.js with MongoDB backend
- Real-time features depend on Ably service
- Authentication via NextAuth (currently configured providers)
- Must support both desktop and mobile form factors equally
