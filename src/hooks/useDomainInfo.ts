import { useEffect, useState } from 'react'
import { ZERO_ADDRESS, ZERO_HASH } from '../sdk/constants'
import FACTORY from 'contracts/build/Factory.json'
import { StorageState } from 'state/application/reducer'
import { useStorageContract } from './useContract'
import { useActiveWeb3React } from 'hooks'
import { getContractInstance } from 'utils/contract'
import { isValidColor } from 'utils/color'
import { filterTokenLists } from 'utils/list'
import { STORAGE_APP_KEY } from '../constants'

const validArray = (arr: any[]) => Array.isArray(arr) && !!arr.length

const defaultSettings = (): StorageState => ({
  admin: '',
  contracts: {},
  factory: '',
  router: '',
  pairHash: '',
  feeRecipient: '',
  protocolFee: undefined,
  totalFee: undefined,
  allFeeToProtocol: undefined,
  possibleProtocolPercent: [],
  totalSwaps: undefined,
  domain: '',
  projectName: '',
  brandColor: '',
  backgroundColorDark: '',
  backgroundColorLight: '',
  textColorDark: '',
  textColorLight: '',
  logo: '',
  background: '',
  tokenListsByChain: {},
  tokenLists: [],
  navigationLinks: [],
  menuLinks: [],
  socialLinks: [],
  addressesOfTokenLists: [],
  disableSourceCopyright: false,
  defaultSwapCurrency: { input: '', output: '' },
})

const parseSettings = (settings: string, chainId: number): StorageState => {
  const appSettings = defaultSettings()

  try {
    const settingsJSON = JSON.parse(settings)

    if (!settingsJSON?.[STORAGE_APP_KEY]) {
      settingsJSON[STORAGE_APP_KEY] = {}
    }
    if (!settingsJSON[STORAGE_APP_KEY]?.contracts) {
      settingsJSON[STORAGE_APP_KEY].contracts = {}
    }
    if (!settingsJSON[STORAGE_APP_KEY]?.contracts) {
      settingsJSON[STORAGE_APP_KEY].tokenLists = {}
    }

    const { definance: parsedSettings } = settingsJSON

    const {
      contracts,
      pairHash,
      feeRecipient,
      domain,
      projectName,
      brandColor,
      backgroundColorDark,
      backgroundColorLight,
      textColorDark,
      textColorLight,
      logoUrl,
      backgroundUrl,
      navigationLinks,
      menuLinks,
      socialLinks,
      tokenLists,
      addressesOfTokenLists,
      disableSourceCopyright,
      defaultSwapCurrency,
    } = parsedSettings

    appSettings.contracts = contracts

    if (contracts[chainId]) {
      const { factory, router } = contracts[chainId]

      appSettings.factory = factory
      appSettings.router = router
    }

    if (pairHash !== ZERO_HASH) appSettings.pairHash = pairHash
    if (feeRecipient !== ZERO_ADDRESS) appSettings.feeRecipient = feeRecipient
    if (domain) appSettings.domain = domain
    if (projectName) appSettings.projectName = projectName

    if (isValidColor(brandColor)) appSettings.brandColor = brandColor
    if (isValidColor(backgroundColorDark)) appSettings.backgroundColorDark = backgroundColorDark
    if (isValidColor(backgroundColorLight)) appSettings.backgroundColorLight = backgroundColorLight
    if (isValidColor(textColorDark)) appSettings.textColorDark = textColorDark
    if (isValidColor(textColorLight)) appSettings.textColorLight = textColorLight

    if (backgroundUrl) appSettings.background = backgroundUrl
    if (logoUrl) appSettings.logo = logoUrl
    if (Boolean(disableSourceCopyright)) appSettings.disableSourceCopyright = disableSourceCopyright

    if (validArray(navigationLinks)) appSettings.navigationLinks = navigationLinks
    if (validArray(menuLinks)) appSettings.menuLinks = menuLinks
    if (validArray(socialLinks)) appSettings.socialLinks = socialLinks
    if (validArray(addressesOfTokenLists)) appSettings.addressesOfTokenLists = addressesOfTokenLists

    if (tokenLists && Object.keys(tokenLists).length) {
      appSettings.tokenListsByChain = tokenLists

      if (tokenLists[chainId]) {
        appSettings.tokenLists = filterTokenLists(tokenLists[chainId])
      }
    }

    if (defaultSwapCurrency) {
      const { input, output } = defaultSwapCurrency

      if (input) appSettings.defaultSwapCurrency.input = input
      if (output) appSettings.defaultSwapCurrency.output = output
    }
  } catch (error) {
    console.group('%c Storage settings', 'color: red')
    console.error(error)
    console.log('source settings: ', settings)
    console.groupEnd()
  }

  return appSettings
}

export default function useDomainInfo(trigger: boolean): {
  data: StorageState | null
  isLoading: boolean
  error: Error | null
} {
  const { chainId, library } = useActiveWeb3React()
  const storage = useStorageContract()
  const [data, setData] = useState<StorageState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!storage) return setData(null)

      setError(null)
      setIsLoading(true)

      let fullData = defaultSettings()

      try {
        const currentDomain = window.location.hostname || document.location.host
        const { info, owner } = await storage.methods.getData(currentDomain).call()

        const settings = parseSettings(info, chainId || 0)
        const { contracts, factory, router } = settings

        const registredDomain = owner !== ZERO_ADDRESS && Object.keys(contracts).length

        if (!registredDomain) return setData(null)

        fullData = { ...settings, admin: owner }

        if (!factory || !router) return setData(null)

        //@ts-ignore
        const factoryContract = getContractInstance(library, factory, FACTORY.abi)

        const INIT_CODE_PAIR_HASH = await factoryContract.methods.INIT_CODE_PAIR_HASH().call()

        fullData = { ...fullData, pairHash: INIT_CODE_PAIR_HASH }

        try {
          const factoryInfo = await factoryContract.methods.allInfo().call()
          const { protocolFee, feeTo, totalFee, allFeeToProtocol, POSSIBLE_PROTOCOL_PERCENT, totalSwaps } = factoryInfo

          fullData = {
            ...fullData,
            protocolFee,
            feeRecipient: feeTo,
            totalFee,
            allFeeToProtocol,
            possibleProtocolPercent: validArray(POSSIBLE_PROTOCOL_PERCENT) ? POSSIBLE_PROTOCOL_PERCENT.map(Number) : [],
            totalSwaps: totalSwaps || undefined,
          }
        } catch (error) {
          console.group('%c Factory info', 'color: red;')
          console.error(error)
          console.groupEnd()
        }

        setData(fullData)
      } catch (error) {
        console.group('%c Domain data request', 'color: red;')
        console.error(error)
        console.groupEnd()
        setError(error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [storage, trigger, library, chainId])

  return { data, isLoading, error }
}
