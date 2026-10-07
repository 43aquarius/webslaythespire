from PIL import Image
import numpy as np
import os
os.chdir('/home/z/my-project/public/assets')

im = np.array(Image.open('frames/bannerCommon.png').convert('RGBA'))
alpha = im[:, :, 3]
col = alpha[:, 250:262].max(axis=1)
ys = np.where(col > 100)[0]
print('banner中轴实区y:', ys.min(), '..', ys.max())

imf = np.array(Image.open('frames/frameAttackCommon.png').convert('RGBA'))
colf = imf[:, 250:262, 3].max(axis=1)
print('colf shape:', colf.shape)
y = 90
while y < 460:
    v = colf[y]
    if v < 30:
        y0 = y
        while y < 460 and colf[y] < 30:
            y += 1
        if y - y0 > 30:
            print(f'frame中轴透明段: y={y0}..{y-1} (高{y-y0})')
    else:
        y += 1

row = imf[200]
solid = np.where(row > 100)[0]
segs = np.split(solid, np.where(np.diff(solid) > 3)[0] + 1)
print('frame y=200 实区分段:', [(int(s.min()), int(s.max())) for s in segs])

row2 = alpha[200]
solid2 = np.where(row2 > 100)[0]
segs2 = np.split(solid2, np.where(np.diff(solid2) > 3)[0] + 1)
print('banner y=200 实区分段:', [(int(s.min()), int(s.max())) for s in segs2])
