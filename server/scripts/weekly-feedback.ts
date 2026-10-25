import "dotenv/config";
/** 크론에서 직접 실행용: `npm run feedback:weekly` */
import { generateWeeklyFeedback } from "../src/lib/feedback";

generateWeeklyFeedback()
  .then((fb) => {
    console.log(`[${fb.model}]\n${fb.content}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
