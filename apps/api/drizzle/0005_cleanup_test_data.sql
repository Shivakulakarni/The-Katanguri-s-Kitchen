-- Clean up test categories and dishes from production
-- Test category 15: "TEST CATEGORY" (0 dishes)
-- Test category 16: "QA TEST" (0 dishes)

DELETE FROM categories WHERE id IN (15, 16);
DELETE FROM dishes WHERE name LIKE '%Test Dish%' OR name LIKE '%QA Test%';
