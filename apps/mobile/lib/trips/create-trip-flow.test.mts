import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const newTripScreenSource = readFileSync(new URL('../../app/trips/new.tsx', import.meta.url), 'utf8');
const tripDateRangeCalendarSource = readFileSync(
  new URL('../trip-ui/TripDateRangeCalendar.tsx', import.meta.url),
  'utf8',
);

test('successful trip creation redirects Home without rendering a multi-action success screen', () => {
  assert.match(newTripScreenSource, /await createTrip\(\{[\s\S]*?\}\);\n\s+router\.replace\('\/'\);/);
  assert.doesNotMatch(newTripScreenSource, /setCreated|const \[created|여행 상세 보기|마이페이지에서 보기/);
});

test('trip creation wizard keeps destination search inline without an extra screen depth', () => {
  assert.doesNotMatch(
    newTripScreenSource,
    /destinationSearchOpen|DestinationSearchFlow/,
    'destination search should render inside the step card instead of switching to a separate full-screen flow',
  );
  assert.doesNotMatch(newTripScreenSource, />여행 만들기<\/Text>/, 'global create-title header should be removed');
  assert.match(newTripScreenSource, /InlineDestinationSearchPanel/, 'expected an inline destination search panel');
  assert.match(newTripScreenSource, /StepWizardHeader/, 'expected the shared step wizard header pattern');
});

test('trip creation wizard shows compact popular city rows and direct date calendar without stacked footer depth', () => {
  assert.match(
    newTripScreenSource,
    /popularTripDestinations/,
    'expected curated popular destinations in the city step',
  );
  assert.match(newTripScreenSource, /PopularDestinationList/, 'expected a compact popular destination row list');
  assert.match(newTripScreenSource, /SelectableListRow/, 'expected compact city rows to use the shared row component');
  assert.doesNotMatch(
    newTripScreenSource,
    /popularDestinationRow/,
    'compact row styles should live in design components',
  );
  assert.doesNotMatch(
    newTripScreenSource,
    /PopularDestinationGrid/,
    'large popular destination grid should be removed',
  );
  assert.doesNotMatch(
    newTripScreenSource,
    /flexBasis: '48%'/,
    'popular city choices should not render as two-column cards',
  );
  assert.match(newTripScreenSource, /TripDateRangeCalendar/, 'expected the date step to show a direct range calendar');
  assert.doesNotMatch(newTripScreenSource, /TripDateRangeEditor/, 'date step should not use tap-to-open date fields');
  assert.match(newTripScreenSource, /useStickyActionFooterLayout\(\{ actionCount: 1 \}\)/);
  assert.doesNotMatch(newTripScreenSource, /actionCount=\{isFirstStep \? 1 : 2\}/);
  assert.match(
    newTripScreenSource,
    /<ConfirmationModal[\s\S]*pendingCountryMismatchConfirmation/,
    'popular-city country mismatch confirmation should be visible in a popup even before server search runs',
  );
});

test('trip creation wizard uses shared split section cards and a minimal step header for small screens', () => {
  assert.match(newTripScreenSource, /<StepWizardHeader/, 'expected a shared compact step header pattern');
  assert.match(newTripScreenSource, /<SectionCard/, 'expected shared meaning-level section cards');
  assert.doesNotMatch(newTripScreenSource, /stepHeaderCard:/, 'step header card styles should live in design patterns');
  assert.doesNotMatch(newTripScreenSource, /sectionCard:/, 'section card styles should live in design patterns');
  assert.doesNotMatch(
    newTripScreenSource,
    /function StepProgressSegments/,
    'progress segments should live in StepWizardHeader',
  );
  assert.doesNotMatch(newTripScreenSource, /wizardCard/, 'single full-height wizard wrapper card should be removed');
  assert.doesNotMatch(newTripScreenSource, /stepSummaryStrip/, 'summary badges should not add extra vertical depth');
  assert.doesNotMatch(newTripScreenSource, /stepSubtitle/, 'explanatory step subtitles should be removed');
});

test('trip date range calendar does not duplicate selected range as a large summary above chips', () => {
  assert.match(tripDateRangeCalendarSource, /rangeChipRow/, 'expected compact start and end chips');
  assert.doesNotMatch(tripDateRangeCalendarSource, /rangeSummaryTitle/, 'large selected range title should be removed');
  assert.doesNotMatch(
    tripDateRangeCalendarSource,
    /formatTripDateRangeSummary/,
    'calendar component should not render a duplicate large range string',
  );
});
