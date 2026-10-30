/* Which source modules a headless harness needs, in one place.

   Seven test files each carried their own hardcoded list, so adding
   11-design.js and 12-curve.js broke six of them at once — and the
   seventh, test/ai.js, had a whole copy of the solver in it for the same
   reason. A list repeated seven times is a list that will be wrong.

   CORE is everything the level data and the engine need and nothing that
   touches a document. */
/* 14-tune.js is in both because levelDef() asks it for the move budget;
   headless it has no network and no save, so it answers with the
   compiled numbers and the harnesses measure the game as built */
const CORE = ['00-util.js', '10-data.js', '11-design.js', '12-curve.js', '13-run-fit.js', '14-tune.js', '30-engine.js'];
/* the save layer as well, for anything asking about pets */
const WITH_SAVE = ['00-util.js', '10-data.js', '11-design.js', '12-curve.js', '13-run-fit.js', '14-tune.js', '15-save.js'];
module.exports = { CORE, WITH_SAVE };
