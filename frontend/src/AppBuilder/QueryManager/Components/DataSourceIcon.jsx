import React from 'react';
import { getSvgIcon } from '@/_helpers/appUtils';
import RunjsIcon from '@/Editor/Icons/runjs.svg';
import RunTooljetDbIcon from '@/Editor/Icons/tooljetdb.svg';
import RunpyIcon from '@/Editor/Icons/runpy.svg';
import ResponseIcon from '@assets/images/icons/response.svg';
import IfIcon from '@assets/images/icons/if.svg';
import LoopIcon from '@assets/images/icons/loop.svg';

const DataSourceIcon = ({ source, height = 25, styles }) => {
  const iconFile = source?.plugin?.iconFile?.data ?? source?.plugin?.icon_file?.data;
  const Icon = () => getSvgIcon(source?.kind, height, height, iconFile, styles);

  switch (source?.kind) {
    case 'runjs':
      return <RunjsIcon style={{ height: height, width: height, marginTop: '-3px' }} />;
    case 'runpy':
      return <RunpyIcon style={{ height: height, width: height, marginTop: '-3px' }} />;
    case 'tooljetdb':
      return <RunTooljetDbIcon style={{ height: height, width: height, marginTop: '-3px' }} />;
    case 'If condition':
      return <IfIcon style={{ height: height, width: height, marginTop: '-3px' }} />;
    case 'loop':
      return <LoopIcon style={{ height: height, width: height, marginTop: '-3px' }} />;
    case 'response':
      return <ResponseIcon style={{ height: height, width: height, marginTop: '-3px' }} />;
    default:
      return <Icon />;
  }
};

export default DataSourceIcon;
