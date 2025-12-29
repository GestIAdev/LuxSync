import re

# Update LatinoStereoPhysics.ts wave tag
filepath = r'electron-app\src\main\selene-lux-core\physics\LatinoStereoPhysics.ts'
content = open(filepath, encoding='utf-8').read()
content = content.replace("wave: 'WAVE 163.5'", "wave: 'WAVE 166 NO WORKER'")
open(filepath, 'w', encoding='utf-8').write(content)
print('LatinoStereoPhysics.ts: wave tag -> WAVE 166 NO WORKER')
