// Test file to verify RedisCommandListener compilation
import { RedisCommandListener } from "./RedisCommandListener.js";
async function test() {
    console.log("Testing RedisCommandListener...");
    await RedisCommandListener.startRedisCommandListener();
}
test();
//# sourceMappingURL=test_redis_listener.js.map