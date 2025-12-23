import { test, expect } from "../../fixtures";
import {
  createTestRewardChart,
  createTestRewardChartTask,
  createTestRewardChartGoal,
} from "../../utils/test-data-factory";

test.describe("Reward Chart", () => {
  test("displays chart with tasks and goal", async ({
    page,
    context,
    familyWithMembers,
    applyAuth,
    seeder,
  }) => {
    // Apply authentication
    await applyAuth(context, [
      familyWithMembers.sessionCookie,
      familyWithMembers.familyCookie,
    ]);

    // Create test chart for a child member (participant), not the manager
    const childMember = familyWithMembers.additionalMembers[0];
    const chart = createTestRewardChart(
      familyWithMembers.family.id,
      childMember.membership.id
    );
    await seeder.seedRewardChart(chart);

    // Create test task
    const task = createTestRewardChartTask(chart.id, {
      title: "Brush Teeth",
      icon: "dentistry",
      iconColor: "blue",
    });
    await seeder.seedRewardChartTask(task);

    // Create test goal
    const goal = createTestRewardChartGoal(chart.id, {
      title: "Ice Cream Trip",
      emoji: "🍦",
      starTarget: 10,
      starsCurrent: 3,
    });
    await seeder.seedRewardChartGoal(goal);

    // Navigate to chart
    await page.goto("/reward-chart");

    // Verify chart elements are visible (use first() for elements that may appear multiple times)
    await expect(page.getByText("Star Chart").first()).toBeVisible();
    await expect(page.getByText("Brush Teeth").first()).toBeVisible();
    await expect(page.getByText("Ice Cream Trip").first()).toBeVisible();
    await expect(page.getByText("3 / 10").first()).toBeVisible();
  });

  test("can complete a task", async ({
    page,
    context,
    familyWithMembers,
    applyAuth,
    seeder,
  }) => {
    await applyAuth(context, [
      familyWithMembers.sessionCookie,
      familyWithMembers.familyCookie,
    ]);

    // Create chart for child member (participant)
    const childMember = familyWithMembers.additionalMembers[0];
    const chart = createTestRewardChart(
      familyWithMembers.family.id,
      childMember.membership.id
    );
    await seeder.seedRewardChart(chart);

    // Create task for today
    const today = new Date().getDay();
    const task = createTestRewardChartTask(chart.id, {
      title: "Test Task",
      daysOfWeek: JSON.stringify([today]),
    });
    await seeder.seedRewardChartTask(task);

    await page.goto("/reward-chart");

    // Find and click pending cell
    const pendingButton = page.getByLabel("Pending - click to complete");
    await pendingButton.click();

    // Verify star appears
    await expect(page.getByText("⭐")).toBeVisible();
  });
});
